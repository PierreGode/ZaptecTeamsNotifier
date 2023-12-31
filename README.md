# ZaptecTeamsNotifier


![image](https://github.com/PierreGode/ZaptecTeamsNotifier/assets/8579922/4045aa5a-f37a-4df1-8192-ee26e2a8e7b2)



Send notifications of availible Zaptec chargers that are availible in your Zaptec account to Teams

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/J3J2EARPK)

Create a .env file: At the root of your project, create a file named .env

Clone this repository
```
https://github.com/PierreGode/ZaptecTeamsNotifier.git
```
```
cd ZaptecTeamsNotifier
```
```
npm install axios
```

```
npm install dotenv
```

```
touch .env
```


Add your secrets/configuration: Inside this file, you can set your environment variables as key-value pairs:

```
ZAPTEC_USERNAME=myUsername
ZAPTEC_PASSWORD=myPassword
TEAMS_WEBHOOK_URL=webhookUrl
COMPANY_NAME=word
```
COMPANY_NAME= comapany name or word to be removed from status eg api presents your chargers as company 01 company 02 company 03 company 04 you can remove the word company by adding it to .env COMPANY_NAME=company and the result will be 01 02 03 04<p>
Access in code: With the help of libraries like dotenv, you can easily load these variables into your application's environment. For Node.js applications, after setting up dotenv, you can access these variables using process.env.VARIABLE_NAME.
note that it is never a good practice to store passwords in clear text on a file, this example is to get started locally.

Create a .gitignore file
```
touch .gitignore
```

Add .env to .gitignore: This is crucial. The .gitignore file tells Git which files or directories to ignore in a project. By adding .env to .gitignore, you ensure that the .env file is not committed to your repository, keeping your secrets safe. The .gitignore entry would simply look like:
```
.env
```
By doing this, even if you accidentally try to commit the .env file, Git will ignore it, ensuring that your secrets remain local and are not exposed in the remote repository.

Running the Notifier
Once you've set up the configurations, run the notifier using:
```
node node.js
```
preferably setup an @reboot sleep 60 && /usr/local/bin/node /home/pi/ZaptecSlackNotifier/node.js >> /var/log/slack.log 2>&1 in crontab

ZaptecTeamsNotifier will send notifications about a charger when it becomes available, updates are pulled every 3 minutes but notifications will not be repeated until the status is changed.
notifocation is only sent when OperatingMode == 1 and 1 = Charger is available! and OperatingMode == 3 Charger has stopped charging<p>
Notifications are silenced after work hours 16-06 and weekends. this can be  configured in config.js<p>
//@Created By Pierre Gode
