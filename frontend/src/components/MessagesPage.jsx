import { useCallback, useEffect, useRef, useState } from 'react'
import { API_URL } from '../lib/api.js'
import { conversationMatchesTab, groupMessagesByDate, MESSAGE_MAX_LENGTH, messageParticipant } from '../lib/messageUi.js'
import { unreadMessageCount } from '../lib/messageUnread.js'
import Modal from './Modal.jsx'

const roleLabel=(role='')=>role.replaceAll('_',' ').toLowerCase().replace(/\b\w/g,(letter)=>letter.toUpperCase())
const shortTime=(value)=>{const date=new Date(value);return Number.isNaN(date.getTime())?'':date.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}
const shortDate=(value)=>{const date=new Date(value);if(Number.isNaN(date.getTime()))return '';const today=new Date();return date.toDateString()===today.toDateString()?shortTime(value):date.toLocaleDateString([],{month:'short',day:'numeric'})}

function MessagesPage({token,role,onUnreadChange,realtimeSocket}){
  const [conversations,setConversations]=useState([])
  const [selected,setSelected]=useState(null)
  const [messages,setMessages]=useState([])
  const [search,setSearch]=useState('')
  const [tab,setTab]=useState('ALL')
  const [page,setPage]=useState(1)
  const [pages,setPages]=useState(1)
  const [unreadTotal,setUnreadTotal]=useState(0)
  const [messagePage,setMessagePage]=useState(1)
  const [messagePages,setMessagePages]=useState(1)
  const [reply,setReply]=useState('')
  const [error,setError]=useState('')
  const [loading,setLoading]=useState(true)
  const [threadError,setThreadError]=useState('')
  const [threadLoading,setThreadLoading]=useState(false)
  const [sending,setSending]=useState(false)
  const [showNew,setShowNew]=useState(false)
  const [recipients,setRecipients]=useState([])
  const [recipientLoading,setRecipientLoading]=useState(false)
  const [creating,setCreating]=useState(false)
  const [newForm,setNewForm]=useState({recipient:'',subject:'',message:''})
  const selectedRef=useRef(null)
  const threadEndRef=useRef(null)
  const isStudent=role==='STUDENT'
  const canManageStatus=['ADMIN','DISCIPLINE_OFFICE'].includes(role)
  const authHeaders={Authorization:`Bearer ${token}`}
  const jsonHeaders={...authHeaders,'Content-Type':'application/json'}

  const load=useCallback(async({requestedPage=1,append=false}={})=>{
    const query=new URLSearchParams({page:String(requestedPage),limit:'25',status:tab==='CLOSED'?'CLOSED':'ALL'})
    if(search.trim())query.set('search',search.trim())
    const response=await fetch(`${API_URL}/api/messages/conversations?${query}`,{headers:{Authorization:`Bearer ${token}`}})
    const data=await response.json().catch(()=>({}))
    if(!response.ok)throw new Error(data.message||'Unable to load conversations.')
    const items=Array.isArray(data.conversations)?data.conversations:[]
    setConversations((current)=>append?[...current,...items.filter((item)=>!current.some((existing)=>existing.id===item.id))]:items)
    setPage(requestedPage);setPages(Math.max(1,Number(data.pagination?.pages)||1))
    const nextUnreadTotal=Number(data.unread_total ?? unreadMessageCount(items))
    if(tab==='ALL'&&!search.trim()){
      setUnreadTotal(nextUnreadTotal)
      onUnreadChange?.(nextUnreadTotal)
    }
  },[onUnreadChange,search,tab,token])

  useEffect(()=>{let active=true;setLoading(true);setError('');const timer=window.setTimeout(()=>load().catch((loadError)=>{if(active)setError(loadError.message)}).finally(()=>{if(active)setLoading(false)}),200);return()=>{active=false;window.clearTimeout(timer)}},[load])
  useEffect(()=>{selectedRef.current=selected},[selected])

  const fetchThread=useCallback(async(conversation,{requestedPage=1,prepend=false,markRead=false}={})=>{
    const response=await fetch(`${API_URL}/api/messages/conversations/${conversation.id}?page=${requestedPage}&limit=50`,{headers:{Authorization:`Bearer ${token}`}})
    const data=await response.json().catch(()=>({}))
    if(!response.ok)throw new Error(data.message||'Unable to open conversation.')
    setSelected(data.conversation);setMessages((current)=>prepend?[...(data.messages||[]).filter((item)=>!current.some((existing)=>existing.id===item.id)),...current]:(data.messages||[]));setMessagePage(requestedPage);setMessagePages(Math.max(1,Number(data.pagination?.pages)||1))
    if(markRead){await fetch(`${API_URL}/api/messages/conversations/${conversation.id}/read`,{method:'PATCH',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:'{}'});await load()}
  },[load,token])

  const open=async(conversation)=>{setThreadError('');setSelected(conversation);setMessages([]);setThreadLoading(true);try{await fetchThread(conversation,{markRead:true});window.setTimeout(()=>threadEndRef.current?.scrollIntoView({block:'end'}),0)}catch(openError){setThreadError(openError.message)}finally{setThreadLoading(false)}}

  useEffect(()=>{if(!realtimeSocket)return undefined;const refresh=()=>{load().catch(()=>{});if(selectedRef.current)fetchThread(selectedRef.current).catch(()=>{})};realtimeSocket.on('messages:changed',refresh);return()=>realtimeSocket.off('messages:changed',refresh)},[fetchThread,load,realtimeSocket])

  const loadRecipients=async()=>{setRecipientLoading(true);setError('');try{const response=await fetch(`${API_URL}/api/messages/recipients`,{headers:authHeaders}),data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||'Unable to load recipients.');setRecipients(data.recipients||[]);setShowNew(true)}catch(loadError){setError(loadError.message)}finally{setRecipientLoading(false)}}
  const create=async(event)=>{event.preventDefault();if(creating)return;setCreating(true);setError('');try{const recipient=recipients.find((item)=>`${item.type}:${item.id??''}`===newForm.recipient);if(!recipient)throw new Error('Select an authorized recipient.');const body=isStudent?{recipient_department_id:recipient.type==='DEPARTMENT'?recipient.id:null,subject:newForm.subject,message:newForm.message}:{student_id:recipient.id,subject:newForm.subject,message:newForm.message};const response=await fetch(`${API_URL}/api/messages/conversations`,{method:'POST',headers:jsonHeaders,body:JSON.stringify(body)}),data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||'Unable to create conversation.');setNewForm({recipient:'',subject:'',message:''});setShowNew(false);await load();await open(data.conversation)}catch(createError){setError(createError.message)}finally{setCreating(false)}}
  const send=async(event)=>{event?.preventDefault();const text=reply.trim();if(!text||sending||!selected)return;setSending(true);setThreadError('');try{const response=await fetch(`${API_URL}/api/messages/conversations/${selected.id}/messages`,{method:'POST',headers:jsonHeaders,body:JSON.stringify({message:text})}),data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||'Unable to send message.');setReply('');await fetchThread(selected);await load();window.setTimeout(()=>threadEndRef.current?.scrollIntoView({block:'end'}),0)}catch(sendError){setThreadError(sendError.message)}finally{setSending(false)}}
  const onComposerKeyDown=(event)=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();send()}}
  const updateStatus=async()=>{const status=selected.status==='OPEN'?'CLOSED':'OPEN';setThreadError('');try{const response=await fetch(`${API_URL}/api/messages/conversations/${selected.id}/status`,{method:'PATCH',headers:jsonHeaders,body:JSON.stringify({status})}),data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||'Unable to update conversation.');setSelected((current)=>({...current,status}));await load()}catch(statusError){setThreadError(statusError.message)}}

  const visibleConversations=conversations.filter((conversation)=>conversationMatchesTab(conversation,tab))
  const participant=selected?messageParticipant(selected,role):null
  return <div className={`messages-page messages-inbox${selected?' has-open-thread':''}`}>
    <section className="messages-page-heading"><div><p className="eyebrow">Secure communication</p><h2>Messages</h2><p>Official, text-only conversations with authorized school participants.</p></div><button type="button" className="messages-new-button" onClick={loadRecipients} disabled={recipientLoading}>{recipientLoading?'Loading…':'New Message'}</button></section>
    {error&&<p className="error-message" role="alert">{error}</p>}
    <div className="messages-workspace">
      <section className="conversation-pane" aria-label="Conversations"><div className="conversation-pane-header"><h3>Conversations</h3><label className="conversation-search"><span className="sr-only">Search conversations</span><input type="search" value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="Search conversations"/></label><div className="conversation-tabs" role="tablist" aria-label="Conversation filters">{['ALL','UNREAD','CLOSED'].map((value)=><button key={value} type="button" role="tab" aria-selected={tab===value} onClick={()=>setTab(value)}>{value[0]+value.slice(1).toLowerCase()}{value==='UNREAD'&&unreadTotal>0?<b>{unreadTotal}</b>:null}</button>)}</div></div>
        <div className="conversation-list">{loading?<p className="message-state">Loading conversations…</p>:visibleConversations.length===0?<p className="message-state">No {tab==='ALL'?'':tab.toLowerCase()} conversations found.</p>:visibleConversations.map((conversation)=>{const itemParticipant=messageParticipant(conversation,role);return <button type="button" key={conversation.id} className={selected?.id===conversation.id?'active':''} aria-pressed={selected?.id===conversation.id} onClick={()=>open(conversation)}><span className="conversation-avatar" aria-hidden="true">{itemParticipant.name.charAt(0)}</span><span className="conversation-summary"><span className="conversation-subject"><strong>{conversation.subject}</strong><time>{shortDate(conversation.latest_message_at||conversation.updated_at)}</time></span><span>{itemParticipant.name} · {itemParticipant.detail}</span><span className="conversation-preview">{conversation.message_preview||'No messages yet'}</span></span><span className={`conversation-status ${conversation.status.toLowerCase()}`}>{conversation.status}</span>{Number(conversation.unread_count)>0?<b className="conversation-unread" aria-label={`${conversation.unread_count} unread messages`}>{conversation.unread_count}</b>:null}</button>})}{page<pages?<button type="button" className="conversation-load-more" onClick={()=>load({requestedPage:page+1,append:true})}>Load more</button>:null}</div>
      </section>
      <section className="chat-pane" aria-live="polite">{!selected?<div className="message-state message-state--center"><strong>Select a conversation</strong><span>Choose a thread to read and reply.</span></div>:<><header className="chat-header"><button type="button" className="chat-mobile-back" onClick={()=>setSelected(null)}>Back</button><span className="conversation-avatar" aria-hidden="true">{participant.name.charAt(0)}</span><div><h3>{selected.subject}</h3><p>{participant.name} · {participant.detail}</p></div><span className={`chat-status ${selected.status.toLowerCase()}`}>{selected.status}</span>{canManageStatus?<button type="button" className="chat-status-action" onClick={updateStatus}>{selected.status==='OPEN'?'Close':'Reopen'}</button>:null}</header>
        <div className="chat-history">{threadLoading?<p className="message-state">Loading messages…</p>:threadError?<p className="error-message" role="alert">{threadError}</p>:<>{messagePage<messagePages?<button type="button" className="message-load-earlier" onClick={()=>fetchThread(selected,{requestedPage:messagePage+1,prepend:true})}>Load earlier messages</button>:null}{groupMessagesByDate(messages).map((group)=><section key={group.label} className="message-date-group"><div className="message-date-divider"><span>{group.label}</span></div>{group.messages.map((message)=><article key={message.id} className={`message-bubble-row${message.sent_by_me?' mine':''}`}><div className="message-bubble"><p>{message.message_text}</p><footer><span>{message.sent_by_me?'You':message.sender_name} · {roleLabel(message.sender_role)}</span><time>{shortTime(message.created_at)}</time></footer></div></article>)}</section>)}</>}<div ref={threadEndRef}/></div>
        <div className="message-record-note">Messages are recorded as official school communication.</div><form className="chat-composer" onSubmit={send}><label><span className="sr-only">Message</span><textarea value={reply} onChange={(event)=>setReply(event.target.value.slice(0,MESSAGE_MAX_LENGTH))} onKeyDown={onComposerKeyDown} maxLength={MESSAGE_MAX_LENGTH} placeholder={selected.status==='OPEN'?'Type your message…':'This conversation is closed.'} disabled={sending||selected.status!=='OPEN'}/><small>{reply.length} / {MESSAGE_MAX_LENGTH}</small></label><button type="submit" disabled={sending||selected.status!=='OPEN'||!reply.trim()}>{sending?'Sending…':'Send'}</button><p>Press Enter to send · Shift + Enter for a new line</p></form></>}
      </section>
    </div>
    {showNew?<Modal title="New Message" onClose={()=>!creating&&setShowNew(false)}><form className="message-new-form" onSubmit={create}><label>Recipient<select required value={newForm.recipient} onChange={(event)=>setNewForm({...newForm,recipient:event.target.value})}><option value="">Select an authorized recipient</option>{recipients.map((recipient)=><option key={`${recipient.type}:${recipient.id??''}`} value={`${recipient.type}:${recipient.id??''}`}>{recipient.student_number?`${recipient.student_number} · `:''}{recipient.name} · {roleLabel(recipient.role)}</option>)}</select></label><label>Subject<input required maxLength="200" value={newForm.subject} onChange={(event)=>setNewForm({...newForm,subject:event.target.value})}/><small>{newForm.subject.length} / 200</small></label><label>Message<textarea required maxLength={MESSAGE_MAX_LENGTH} value={newForm.message} onChange={(event)=>setNewForm({...newForm,message:event.target.value.slice(0,MESSAGE_MAX_LENGTH)})}/><small>{newForm.message.length} / {MESSAGE_MAX_LENGTH}</small></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={()=>setShowNew(false)} disabled={creating}>Cancel</button><button type="submit" disabled={creating||!newForm.recipient||!newForm.subject.trim()||!newForm.message.trim()}>{creating?'Sending…':'Start Conversation'}</button></div></form></Modal>:null}
  </div>
}
export default MessagesPage
