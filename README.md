# ZaptecTeamsNotifier
Send notifications of availible Zaptec chargers that are availible in your Zaptec account to Teams
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
```
Access in code: With the help of libraries like dotenv, you can easily load these variables into your application's environment. For Node.js applications, after setting up dotenv, you can access these variables using process.env.VARIABLE_NAME.

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
