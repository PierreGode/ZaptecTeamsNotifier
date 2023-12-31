module.exports = {
    startSilentHour: 16,  // Begin silent period at 16:00 (4 PM)
    endSilentHour: 6,    // End silent period at 6:00 (6 AM)
    timeZone: 'Europe/Stockholm', // Set timezone for logging
    silentStart: true, // on service start set if the initial run should be promoting notifications
    zaptecUpdateInterval: 3*60*1000, // 3 min, the time in milliseconds between api calls to Zaptec portal
    zaptecTokenRefreshInterval: 24*60*60*1000, // 24h
    silentDays: ['Saturday', 'Sunday'], // No notifications on Saturday and Sunday
    iconSet: 2 // 1: unicode circles, 2: unicode icons, 3: slack emojis
};
