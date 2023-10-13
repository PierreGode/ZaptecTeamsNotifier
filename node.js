const { 
    refreshBearerToken, 
    checkChargerAvailability,  
} = require('./ZaptecTeamsNotifier.js');
const config = require('./config');

(async () => {
    console.log("Starting Zaptec Teams Notifier...");
   
    console.log("Setting up intervals for checking charger availability, token refresh...");

    // Check charger availability every 3 minutes
    setInterval(async () => {
        await checkChargerAvailability();
    }, config.Zaptechupdateinterval); // configure in config.js

    // Refresh Zaptec token every 24 hours
    setInterval(async () => {
        await refreshBearerToken();
    }, 86400000); // 24 hours

    console.log("Zaptec Teams Notifier is now running!");
})();

