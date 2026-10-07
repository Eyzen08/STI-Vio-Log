const DAILY_MINUTES = 480;
const round = (value) => Math.round(Number(value) * 1e6) / 1e6;
const minutes = (hours) => Math.max(0, round(Number(hours || 0) * 60));
const serviceDate = (now) => new Date(new Date(now).getTime() + 8 * 3600000).toISOString().slice(0, 10);
const midnight = (now) => Date.parse(`${serviceDate(now)}T00:00:00+08:00`) + 86400000;

const serviceAllowance = (assignment, completedToday, now) => {
    const dailyRemaining = Math.max(0, round(DAILY_MINUTES - Number(completedToday || 0)));
    const remaining = minutes(assignment.remaining_hours ?? (Number(assignment.required_hours) - Number(assignment.completed_hours || 0)));
    return { service_date: serviceDate(now), completed_today_minutes: Number(completedToday || 0),
        daily_remaining_minutes: dailyRemaining, daily_limit_minutes: DAILY_MINUTES,
        available_minutes: Math.max(0, Math.min(dailyRemaining, remaining, Math.floor((midnight(now) - new Date(now).getTime()) / 60000 * 1e6) / 1e6)),
        day_ends_at: new Date(midnight(now)).toISOString() };
};

const validateDuration = (type, duration, available) => {
    const fail = (message) => { const error = new Error(message); error.statusCode = 400; error.code = 'INVALID_SERVICE_DURATION'; throw error; };
    if (!(available > 0)) fail('No community service time is available today.');
    if (type === 'OPEN_TIME') {
        if (duration != null) fail('Open Time must not have a fixed target.');
        return { session_type: type, selected_duration_minutes: null };
    }
    const selected = Number(duration);
    const finalRemainder = available < 120 && selected < 120 && selected + 0.000001 >= available;
    if (type !== 'FIXED' || duration == null || typeof duration === 'boolean' || !Number.isFinite(selected) || selected <= 0
        || (!finalRemainder && (selected > available || available < 120 || selected < 120 || selected > 480 || selected % 60 !== 0))) {
        fail('Select 2–8 whole hours within the available allowance, or the exact final remainder.');
    }
    return { session_type: type, selected_duration_minutes: round(finalRemainder ? available : selected) };
};

const sessionTiming = (session, assignment, completedToday, now) => {
    const start = new Date(session.time_in).getTime();
    const end = new Date(session.time_out || now).getTime();
    const actual = Math.max(0, Math.floor((end - start) / 1000));
    const dailyRemaining = Math.max(0, DAILY_MINUTES - Number(completedToday || 0));
    const requiredRemaining = minutes(assignment.remaining_hours ?? (Number(assignment.required_hours) - Number(assignment.completed_hours || 0)));
    const cutoff = Math.min(new Date(session.credit_cutoff_at || new Date(midnight(session.time_in))).getTime(),
        midnight(session.time_in), Math.ceil(start + Math.min(dailyRemaining, requiredRemaining) * 60000));
    const eligible = Math.max(0, Math.min((end - start) / 1000, (cutoff - start) / 1000));
    const target = session.session_type === 'FIXED' ? Number(session.selected_duration_minutes) * 60 : null;
    const targetCompleted = target != null && eligible + 0.001 >= target;
    return { server_time: new Date(now).toISOString(), actual_elapsed_seconds: actual,
        elapsed_seconds: Math.floor(eligible), remaining_seconds: target == null ? null : targetCompleted ? 0 : Math.max(0, Math.ceil(target - eligible)),
        additional_seconds: target == null ? 0 : Math.max(0, Math.floor(eligible - target)),
        target_completed: targetCompleted,
        daily_remaining_seconds: Math.max(0, Math.ceil(dailyRemaining * 60 - eligible)),
        credit_remaining_seconds: Math.max(0, Math.ceil((cutoff - end) / 1000)),
        credit_cutoff_at: new Date(cutoff).toISOString(), expected_completion_at: target == null ? null : new Date(start + target * 1000).toISOString(),
        timer_limit_seconds: target ?? Math.max(0, Math.floor((cutoff - start) / 1000)),
        cutoff_reason:cutoff===midnight(session.time_in)?'DAY_ENDED':dailyRemaining<=requiredRemaining?'DAILY_LIMIT_REACHED':'REQUIREMENT_FULFILLED',
        limit_reached: end >= cutoff, completed_today_minutes: Number(completedToday || 0), daily_limit_minutes: DAILY_MINUTES };
};

const calculateCredit = (session, assignment, completedToday, now) => {
    const timing = sessionTiming(session, assignment, completedToday, now);
    const start = new Date(session.time_in).getTime();
    const end = new Date(session.time_out || now).getTime();
    const eligibleMinutes = Math.max(0, (Math.min(end, new Date(timing.credit_cutoff_at).getTime()) - start) / 60000);
    const requiredMinutes = minutes(assignment.required_hours);
    const previousMinutes = minutes(assignment.completed_hours);
    const remaining = Math.max(0, round(requiredMinutes - previousMinutes));
    const daily = Math.max(0, round(DAILY_MINUTES - Number(completedToday || 0)));
    // Whole minutes normally; an exact fractional final balance is also creditable.
    const ceiling = Math.min(remaining, daily);
    const creditable = eligibleMinutes + 1e-8 >= ceiling ? ceiling : Math.floor(eligibleMinutes + 1e-8);
    const creditedMinutes = Math.max(0, round(Math.min(creditable, ceiling)));
    const newMinutes = round(previousMinutes + creditedMinutes);
    const remainingMinutes = Math.max(0, round(requiredMinutes - newMinutes));
    const minimumTarget = session.session_type === 'FIXED' ? Number(session.selected_duration_minutes) : Math.min(120, Math.max(0, (new Date(session.credit_cutoff_at).getTime() - start) / 60000));
    const early = eligibleMinutes + 0.001 / 60 < minimumTarget;
    let completionReason = early ? 'EARLY_TIME_OUT' : 'COMPLETED';
    if (timing.limit_reached && end >= midnight(session.time_in) && midnight(session.time_in) <= new Date(timing.credit_cutoff_at).getTime()) completionReason = 'DAY_ENDED';
    if (creditedMinutes >= daily && daily > 0) completionReason = 'DAILY_LIMIT_REACHED';
    return { ...timing, requiredMinutes, previousMinutes, workedMinutes: Math.floor(timing.actual_elapsed_seconds / 60),
        creditedMinutes, newMinutes, remainingMinutes, completionReason,
        attendanceOutcome: remainingMinutes === 0 ? 'SERVICE_COMPLETED' : early ? 'LEFT_EARLY' : 'TODAYS_SERVICE_COMPLETED' };
};

module.exports = { DAILY_MINUTES, serviceDate, serviceAllowance, validateDuration, sessionTiming, calculateCredit };
