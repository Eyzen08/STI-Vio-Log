import Avatar from './Avatar.jsx'
import { notificationTarget } from '../lib/studentNotifications.js'
import { useCallback, useEffect, useRef, useState } from 'react'
import { API_URL } from '../lib/api.js'
import { conversationMatchesTab, conversationTimeLabel, groupMessagesByDate, MESSAGE_MAX_LENGTH, messageParticipant } from '../lib/messageUi.js'
import { unreadMessageCount } from '../lib/messageUnread.js'
import { formatDisplayLabel, formatManilaTime } from '../lib/displayFormat.js'
import Modal from './Modal.jsx'
import PortalIcon from './PortalIcon.jsx'
import '../styles/messages-workflow.css'

const roleLabel=(role='')=>formatDisplayLabel(role)
const shortTime=(value)=>formatManilaTime(value)

function MessagesPage({token,role,students=[],currentUser,onUnreadChange,realtimeSocket,searchParams='',onCloseTarget,onOpenTarget}){
  const target=notificationTarget(searchParams)
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
  const [statusUpdating,setStatusUpdating]=useState(false)
  const [showNew,setShowNew]=useState(false)
  const [recipients,setRecipients]=useState([])
  const [recipientLoading,setRecipientLoading]=useState(false)
  const [recipientSearch,setRecipientSearch]=useState('')
  const [recipientError,setRecipientError]=useState('')
  const [creating,setCreating]=useState(false)
  const [newForm,setNewForm]=useState({recipient:'',subject:'',message:''})
  const [newError,setNewError]=useState('')
  const [touched,setTouched]=useState({})
  const [recipientIndex,setRecipientIndex]=useState(-1)
  const [recipientExpanded,setRecipientExpanded]=useState(true)
  const [conversationTotal,setConversationTotal]=useState(0)
  const recipientRequestRef=useRef(0)
  const recipientSearchRef=useRef(null)
  const subjectRef=useRef(null)
  const selectedRef=useRef(null)
  const threadEndRef=useRef(null)
  const isStudent=role==='STUDENT'
  const canManageStatus=['DISCIPLINE_ADMIN','DISCIPLINE_OFFICE'].includes(role)
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
    setConversationTotal(Number(data.pagination?.total ?? items.length))
    const nextUnreadTotal=Number(data.unread_total ?? unreadMessageCount(items))
    if(tab==='ALL'&&!search.trim()){
      setUnreadTotal(nextUnreadTotal)
      onUnreadChange?.(nextUnreadTotal)
    }
  },[onUnreadChange,search,tab,token])

  useEffect(()=>{let active=true;setLoading(true);setError('');const timer=window.setTimeout(()=>load().catch((loadError)=>{if(active)setError(loadError.message)}).finally(()=>{if(active)setLoading(false)}),200);return()=>{active=false;window.clearTimeout(timer)}},[load])
  useEffect(()=>{selectedRef.current=selected},[selected])

  const fetchThread=useCallback(async(conversation,{requestedPage=1,prepend=false,markRead=false,signal}={})=>{
    const response=await fetch(`${API_URL}/api/messages/conversations/${conversation.id}?page=${requestedPage}&limit=50`,{headers:{Authorization:`Bearer ${token}`},signal})
    const data=await response.json().catch(()=>({}))
    if(!response.ok)throw new Error(data.message||'Unable to open conversation.')
    if(signal?.aborted)return
    setSelected(data.conversation);setMessages((current)=>prepend?[...(data.messages||[]).filter((item)=>!current.some((existing)=>existing.id===item.id)),...current]:(data.messages||[]));setMessagePage(requestedPage);setMessagePages(Math.max(1,Number(data.pagination?.pages)||1))
    if(markRead){await fetch(`${API_URL}/api/messages/conversations/${conversation.id}/read`,{method:'PATCH',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:'{}',signal});if(!signal?.aborted)await load()}
  },[load,token])

  useEffect(()=>{
    if(target.invalid||!target.conversationId)return
    const controller=new AbortController()
    setThreadLoading(true)
    fetchThread({id:target.conversationId},{markRead:true,signal:controller.signal})
      .catch(()=>{if(!controller.signal.aborted)setError('The requested conversation is unavailable or you no longer have access to it.')})
      .finally(()=>{if(!controller.signal.aborted)setThreadLoading(false)})
    return()=>controller.abort()
  },[target.invalid,target.conversationId,fetchThread])

  const open=async(conversation)=>{if(onOpenTarget&&String(conversation.id)!==target.conversationId){onOpenTarget(conversation.id);return}setThreadError('');setSelected(conversation);setMessages([]);setThreadLoading(true);try{await fetchThread(conversation,{markRead:true});window.setTimeout(()=>threadEndRef.current?.scrollIntoView({block:'end'}),0)}catch(openError){setThreadError(openError.message)}finally{setThreadLoading(false)}}

  useEffect(()=>{if(!realtimeSocket)return undefined;const refresh=()=>{load().catch(()=>{});if(selectedRef.current)fetchThread(selectedRef.current).catch(()=>{})};realtimeSocket.on('messages:changed',refresh);return()=>realtimeSocket.off('messages:changed',refresh)},[fetchThread,load,realtimeSocket])

  const resetRecipientPicker=()=>{recipientRequestRef.current+=1;setRecipientSearch('');setRecipientError('');setRecipientLoading(false);setRecipientIndex(-1);setRecipientExpanded(true);setRecipients([]);setNewForm((current)=>({...current,recipient:''}))}
  const closeNewMessage=()=>{if(creating)return;setShowNew(false);resetRecipientPicker()}
  const loadRecipients=useCallback(async(searchTerm='')=>{const requestId=++recipientRequestRef.current;const normalizedSearch=searchTerm.trim();setRecipientLoading(true);setRecipientError('');try{const query=new URLSearchParams();if(normalizedSearch)query.set('search',normalizedSearch);const suffix=normalizedSearch?`?${query}`:'';const response=await fetch(`${API_URL}/api/messages/recipients${suffix}`,{headers:{Authorization:`Bearer ${token}`}}),data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||'Unable to load recipients.');if(requestId!==recipientRequestRef.current)return;const nextRecipients=Array.isArray(data.recipients)?data.recipients:[];setRecipients(nextRecipients);setNewForm((current)=>nextRecipients.some((item)=>`${item.type}:${item.id??''}`===current.recipient)?current:{...current,recipient:''})}catch(loadError){if(requestId!==recipientRequestRef.current)return;setRecipients([]);setNewForm((current)=>({...current,recipient:''}));setRecipientError(loadError.message)}finally{if(requestId===recipientRequestRef.current)setRecipientLoading(false)}},[token])
  const openNewMessage=()=>{resetRecipientPicker();setNewError('');setTouched({});setShowNew(true);if(isStudent)loadRecipients()}
  const chooseRecipient=(recipient)=>{setNewForm(current=>({...current,recipient:`${recipient.type}:${recipient.id??''}`}));setRecipientIndex(-1);setRecipientExpanded(false);window.setTimeout(()=>subjectRef.current?.focus(),0)}
  const onRecipientSearchKeyDown=(event)=>{
    if(event.key==='Escape'&&recipientExpanded){event.preventDefault();event.stopPropagation();setRecipientExpanded(false);return}
    if(['ArrowDown','ArrowUp'].includes(event.key)&&recipients.length){event.preventDefault();setRecipientExpanded(true);setRecipientIndex(current=>current<0?(event.key==='ArrowDown'?0:recipients.length-1):(current+(event.key==='ArrowDown'?1:-1)+recipients.length)%recipients.length)}
    if(event.key==='Enter'){event.preventDefault();if(recipientExpanded&&recipients[recipientIndex])chooseRecipient(recipients[recipientIndex])}
  }
  const onRecipientSearchChange=(event)=>{recipientRequestRef.current+=1;setRecipientSearch(event.target.value);setRecipientLoading(event.target.value.trim().length>=2);setRecipientError('');setRecipients([]);setRecipientIndex(-1);setRecipientExpanded(true);setNewForm(current=>({...current,recipient:''}))}
  const changeRecipient=()=>{resetRecipientPicker();window.setTimeout(()=>recipientSearchRef.current?.focus(),0)}
  useEffect(()=>{if(!showNew||isStudent||recipientSearch.trim().length<2)return undefined;const timer=window.setTimeout(()=>loadRecipients(recipientSearch),300);return()=>window.clearTimeout(timer)},[isStudent,loadRecipients,recipientSearch,showNew])
  const create=async(event)=>{event.preventDefault();if(creating)return;setTouched({recipient:true,subject:true,message:true});if(!newForm.recipient||!newForm.subject.trim()||!newForm.message.trim())return;setCreating(true);setNewError('');try{const recipient=recipients.find((item)=>`${item.type}:${item.id??''}`===newForm.recipient);if(!recipient)throw new Error('Select an authorized recipient.');const body=isStudent?{subject:newForm.subject,message:newForm.message}:{student_id:recipient.id,subject:newForm.subject,message:newForm.message};const response=await fetch(`${API_URL}/api/messages/conversations`,{method:'POST',headers:jsonHeaders,body:JSON.stringify(body)}),data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||'Unable to create conversation.');setNewForm({recipient:'',subject:'',message:''});setShowNew(false);setRecipientSearch('');setRecipientError('');setRecipients([]);await load();await open(data.conversation)}catch(createError){setNewError(createError.message)}finally{setCreating(false)}}
  const send=async(event)=>{event?.preventDefault();const text=reply.trim();if(!text||sending||!selected)return;setSending(true);setThreadError('');try{const response=await fetch(`${API_URL}/api/messages/conversations/${selected.id}/messages`,{method:'POST',headers:jsonHeaders,body:JSON.stringify({message:text})}),data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||'Unable to send message.');setReply('');await fetchThread(selected);await load();window.setTimeout(()=>threadEndRef.current?.scrollIntoView({block:'end'}),0)}catch(sendError){setThreadError(sendError.message)}finally{setSending(false)}}
  const onComposerKeyDown=(event)=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing&&event.keyCode!==229){event.preventDefault();send()}}
  const updateStatus=async()=>{if(statusUpdating)return;const status=selected.status==='OPEN'?'CLOSED':'OPEN';setStatusUpdating(true);setThreadError('');try{const response=await fetch(`${API_URL}/api/messages/conversations/${selected.id}/status`,{method:'PATCH',headers:jsonHeaders,body:JSON.stringify({status})}),data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||'Unable to update conversation.');setSelected((current)=>({...current,status}));await load()}catch(statusError){setThreadError(statusError.message)}finally{setStatusUpdating(false)}}

  const visibleConversations=conversations.filter((conversation)=>conversationMatchesTab(conversation,tab))
  const participant=selected?messageParticipant(selected,role):null
  const selectedRecipient=recipients.find((recipient)=>`${recipient.type}:${recipient.id??''}`===newForm.recipient)
  const recipientContext=(recipient)=>{const student=students.find(item=>Number(item.id)===Number(recipient.id));return [recipient.student_number,student?.program||student?.strand,student?.section].filter(Boolean).join(' · ')||roleLabel(recipient.role)}
  const fieldError=(field)=>touched[field]&&!newForm[field].trim()?(field==='recipient'?'Select a recipient.':`${field==='subject'?'Subject':'Message'} is required.`):''
  return <div className={`messages-page messages-inbox${selected?' has-open-thread':''}`}>
    <section className="messages-page-heading portal-page-header"><div><h2>Messages</h2><p>Communicate securely with students and authorized school staff.</p></div><button type="button" className="messages-new-button" onClick={openNewMessage}><span aria-hidden="true">+</span> New Message</button></section>
    {error&&<p className="error-message" role="alert">{error}</p>}
    <div className="messages-workspace">
      <section className="conversation-pane" aria-label="Conversations"><div className="conversation-pane-header"><div className="conversation-title-row"><h3>Conversations</h3><span>{conversationTotal}</span></div><label className="conversation-search"><PortalIcon name="search"/><span className="sr-only">Search conversations</span><input type="search" name="conversation-filter" autoComplete="off" value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="Search names, subjects, or student numbers"/></label><div className="conversation-tabs" role="tablist" aria-label="Conversation filters">{['ALL','UNREAD','CLOSED'].map((value)=><button key={value} type="button" role="tab" aria-selected={tab===value} tabIndex={tab===value?0:-1} onKeyDown={(event)=>{const values=["ALL","UNREAD","CLOSED"];const index=values.indexOf(value);const next=event.key==="ArrowRight"?(index+1)%3:event.key==="ArrowLeft"?(index+2)%3:event.key==="Home"?0:event.key==="End"?2:-1;if(next>=0){event.preventDefault();setTab(values[next]);event.currentTarget.parentElement.children[next].focus()}}} onClick={()=>setTab(value)}>{value[0]+value.slice(1).toLowerCase()}{value==='UNREAD'&&unreadTotal>0?<b>{unreadTotal}</b>:null}</button>)}</div></div>
        <div className="conversation-list">{loading?<p className="message-state">Loading conversations…</p>:visibleConversations.length===0?<div className="message-state"><strong>No conversations found</strong><span>{search?'Try a different search.':tab==='UNREAD'?'You are all caught up.':'Start a new authorized conversation.'}</span></div>:visibleConversations.map((conversation)=>{const itemParticipant=messageParticipant(conversation,role);const unread=Number(conversation.unread_count)>0;return <button type="button" key={conversation.id} className={`${selected?.id===conversation.id?'active ':''}${unread?'unread':''}`.trim()} aria-pressed={selected?.id===conversation.id} aria-label={`Conversation with ${itemParticipant.name}, subject: ${conversation.subject}${unread?`, ${conversation.unread_count} unread`:''}`} onClick={()=>open(conversation)}><Avatar className="conversation-avatar" identity={itemParticipant}/><span className="conversation-summary"><span className="conversation-primary"><strong title={itemParticipant.name}>{itemParticipant.name}</strong></span><span className="conversation-subject-detail" title={conversation.subject}>{conversation.subject}</span><span className="conversation-preview">{conversation.message_preview || "No messages yet"}</span></span><span className="conversation-row-meta"><time dateTime={conversation.latest_message_at || conversation.updated_at}>{conversationTimeLabel(conversation.latest_message_at || conversation.updated_at || conversation.created_at)}</time>{unread && <i aria-label="Unread"/>}</span></button>})}{page<pages?<button type="button" className="conversation-load-more" onClick={()=>load({requestedPage:page+1,append:true})}>Load more conversations</button>:null}</div>
      </section>
      <section className="chat-pane" aria-live="polite">{!selected?<div className="message-state message-state--center"><span className="message-empty-icon" aria-hidden="true"><PortalIcon name="mail"/></span><strong>{target.conversationId && threadLoading ? 'Loading conversation…' : 'Select a conversation'}</strong><span>Choose a thread to read its official message history and reply.</span></div>:<><header className="chat-header" aria-label={`Conversation with ${participant.name}, subject: ${selected.subject}`}><button type="button" className="chat-mobile-back" onClick={()=>{setSelected(null);onCloseTarget?.()}} aria-label="Back to conversations">←</button><Avatar className="conversation-avatar" identity={participant}/><div><h3 title={participant.name}>{participant.name}</h3><p>{isStudent?participant.detail:`Student · ${selected.student_number || "Not recorded"}`}</p><p className="conversation-subject-detail" title={`Subject: ${selected.subject}`}>Subject: {selected.subject}</p></div><span className="chat-header-actions"><span className={`chat-status ${selected.status.toLowerCase()}`}>{formatDisplayLabel(selected.status)}</span>{canManageStatus?<button type="button" className="chat-status-action" onClick={updateStatus} disabled={statusUpdating}>{statusUpdating?'Saving…':selected.status==='OPEN'?'Close conversation':'Reopen'}</button>:null}</span></header>
        <div className="chat-history">{threadLoading?<p className="message-state">Loading messages…</p>:threadError?<p className="error-message" role="alert">{threadError}</p>:messages.length===0?<div className="message-state message-state--center"><strong>No messages yet</strong><span>Send the first message in this conversation.</span></div>:<>{messagePage<messagePages?<button type="button" className="message-load-earlier" onClick={()=>fetchThread(selected,{requestedPage:messagePage+1,prepend:true})}>Load earlier messages</button>:null}{groupMessagesByDate(messages).map((group)=><section key={group.label} className="message-date-group"><div className="message-date-divider"><span>{group.label}</span></div>{group.messages.map((message)=><article key={message.id} className={`message-bubble-row${message.sent_by_me?' mine':''}`}><Avatar className="message-sender-avatar" identity={{ ...(message.sent_by_me?currentUser:participant), full_name: message.sender_name || (message.sent_by_me?currentUser?.full_name:participant.name), avatar: message.sender_avatar || (message.sent_by_me?currentUser?.avatar:participant.avatar) }}/><div className="message-bubble-content"><div className="message-bubble"><p>{message.message_text}</p></div><footer><span>{message.sent_by_me?'You':(message.sender_name||participant.name)}</span><span aria-hidden="true"> · </span><time dateTime={message.created_at}>{shortTime(message.created_at)}</time></footer></div></article>)}</section>)}</>}<div ref={threadEndRef}/></div>
        <div className="message-record-note"><span aria-hidden="true">◈</span> Messages are retained as official school communication.</div><form className="chat-composer" onSubmit={send}><label><span className="sr-only">Message</span><textarea value={reply} onChange={(event)=>setReply(event.target.value.slice(0,MESSAGE_MAX_LENGTH))} onKeyDown={onComposerKeyDown} maxLength={MESSAGE_MAX_LENGTH} placeholder={selected.status==='OPEN'?'Type a message…':'This conversation is closed. Reopen it to reply.'} disabled={sending||selected.status!=='OPEN'}/><small>{reply.length} / {MESSAGE_MAX_LENGTH}</small></label><button type="submit" disabled={sending||selected.status!=='OPEN'||!reply.trim()}><span>{sending?'Sending…':'Send'}</span><PortalIcon name="send" /></button><p>Enter to send · Shift + Enter for a new line</p></form></>}
      </section>
    </div>
    {showNew?<Modal title="New Message" subtitle={isStudent?"Start a conversation with the Discipline Office.":"Start a conversation with a student."} className="new-message-modal" onClose={closeNewMessage}><form className="message-new-form" onSubmit={create}>{!isStudent?<section className="recipient-picker" aria-labelledby="recipient-label"><span id="recipient-label" className="recipient-picker-label">Recipient</span>{selectedRecipient?<div className="selected-recipient"><Avatar identity={selectedRecipient}/><span><strong>{selectedRecipient.name}</strong><small>{recipientContext(selectedRecipient)}</small></span><button type="button" aria-label="Change recipient" onClick={changeRecipient} disabled={creating}>×</button></div>:<><div className="recipient-search-row"><label><span className="sr-only">Search students by name or student number</span><PortalIcon name="search"/><input ref={recipientSearchRef} type="search" name="recipient-search" role="combobox" aria-autocomplete="list" aria-controls="recipient-preview-list" aria-expanded={recipientExpanded && !recipientLoading && recipients.length>0} aria-activedescendant={recipientIndex>=0 && recipientExpanded?'recipient-option-'+recipientIndex:undefined} autoComplete="off" maxLength="100" value={recipientSearch} onChange={onRecipientSearchChange} onKeyDown={onRecipientSearchKeyDown} onFocus={()=>setRecipientExpanded(true)} onBlur={(event)=>{setTouched(current=>({...current,recipient:true}));if(!event.currentTarget.closest('.recipient-picker').contains(event.relatedTarget))setRecipientExpanded(false)}} placeholder="Search student name or student number…" disabled={creating}/></label></div>{recipientError?<p className="recipient-search-status recipient-search-error" role="alert">{recipientError}</p>:recipientSearch.trim().length<2?<p className="recipient-search-status">Start typing to preview matching students.</p>:recipientLoading?<p className="recipient-search-status" role="status">Searching for students…</p>:recipients.length===0?<p className="recipient-search-status" role="status">No students found. Try a different name or student number.</p>:recipientExpanded?<div id="recipient-preview-list" className="recipient-preview-list" role="listbox" aria-label="Matching students">{recipients.map((recipient,index)=><button key={recipient.type+':'+recipient.id} id={'recipient-option-'+index} type="button" role="option" aria-selected={recipientIndex===index} onClick={()=>chooseRecipient(recipient)} disabled={creating}><Avatar className="recipient-preview-avatar" identity={recipient}/><span><strong>{recipient.name}</strong><small>{recipientContext(recipient)}</small></span></button>)}</div>:null}</>}{fieldError('recipient')&&<small className="recipient-search-error">{fieldError('recipient')}</small>}</section>:<label>Recipient<select required value={newForm.recipient} onChange={(event)=>setNewForm({...newForm,recipient:event.target.value})} disabled={recipientLoading||creating}><option value="">{recipientLoading?'Loading recipient…':'Select an authorized recipient'}</option>{recipients.map((recipient)=><option key={recipient.type+':'+recipient.id} value={recipient.type+':'+(recipient.id??'')}>{recipient.name}</option>)}</select>{recipientError&&<small className="recipient-search-error" role="alert">{recipientError}</small>}</label>}<label>Subject<input ref={subjectRef} aria-describedby={fieldError("subject")?"new-subject-error":undefined} disabled={creating} onBlur={()=>setTouched(current=>({...current,subject:true}))} aria-invalid={Boolean(fieldError("subject"))} required maxLength="200" value={newForm.subject} onChange={(event)=>setNewForm({...newForm,subject:event.target.value})}/><small>{newForm.subject.length} / 200</small>{fieldError("subject")&&<span id="new-subject-error" className="recipient-search-error">{fieldError("subject")}</span>}</label><label>Message<textarea aria-describedby={fieldError("message")?"new-body-error":undefined} disabled={creating} onBlur={()=>setTouched(current=>({...current,message:true}))} aria-invalid={Boolean(fieldError("message"))} required maxLength={MESSAGE_MAX_LENGTH} value={newForm.message} onChange={(event)=>setNewForm({...newForm,message:event.target.value.slice(0,MESSAGE_MAX_LENGTH)})}/><small>{newForm.message.length} / {MESSAGE_MAX_LENGTH}</small>{fieldError("message")&&<span id="new-body-error" className="recipient-search-error">{fieldError("message")}</span>}</label>{newError&&<p className="error-message" role="alert">{newError}</p>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={closeNewMessage} disabled={creating}>Cancel</button><button type="submit" disabled={creating||!newForm.recipient||!newForm.subject.trim()||!newForm.message.trim()}>{creating?'Sending…':'Start Conversation'}</button></div></form></Modal>:null}
  </div>
}
export default MessagesPage
