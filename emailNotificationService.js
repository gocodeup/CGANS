'use strict';

const fs = require('fs');
var nodemailer = require('nodemailer');
var cron = require('node-cron');
const { Octokit } = require("@octokit/core");
const { DateTime } = require("luxon");

const credentials = JSON.parse(fs.readFileSync('credentials.json'));
const octokit = new Octokit({ auth: credentials.githubApiKey });

var transporter = nodemailer.createTransport({
  service: 'outlook',
  auth: {
    user: credentials.hostEmailName,
    pass: credentials.hostEmailPass
  }
});

const sendEmail = (htmlBody, recipentsEmail, emailSubject = "GitHub Activity Reminder", emailType) => {

  var mailOptions = {
    from: credentials.hostEmailName,
    to: recipentsEmail,
    subject: emailSubject,
    html: htmlBody
  };

  transporter.sendMail(mailOptions, function (error) {
    if (error) {
      const currentDate = DateTime.local().toString();
      const errorMessage = `Failed to send ${emailType} email to ${recipentsEmail}.\nDate: ${currentDate}\n${error}\n\n`;
      fs.appendFile('logs.txt', errorMessage, (err) => {
        if (err) throw err;
        console.log("Saved");
      })
    } else {
      console.log(`Successfully sent ${emailType} email to ${recipentsEmail}.\n`);
    }
  });

}


const ReqStudentActivity = (gitHubUserName) => {
  return octokit.request('GET /users/{username}/events', {
    username: gitHubUserName
  })
}

const didStudentPushToday = (userName) => {
  return ReqStudentActivity(userName).then((responce => {
    const pushEvents = responce.data.filter(event => event.type = 'PushEvent')
    const todaysDate = DateTime.local();
    const lastPushEventDate = DateTime.fromISO(pushEvents[0].created_at);
    console.log(todaysDate.toString());
    console.log(lastPushEventDate.toString());
    return dateOne.hasSame(dateTwo, 'day');
  }))
}


const checkGitHubActivity = (userName) => {
  ReqStudentActivity(userName).then((responce => {

    if (responce.data.length == 0) {

      console.log("User has no recent github activity!");
      const currentDate = DateTime.local().toLocaleString();
      const EmailSubject = `${currentDate}, No Github Activity`;
      const superDisapointedEmail = `<h2>Dear ${userName}</h2><p>You currently have no github activity, this is very concerning and can negativley impact your job search.</p><p>You can view your current github activity <a href="https://github.com/${userName}">HERE</a></p>`;
      sendEmail(superDisapointedEmail, "samuel@codeup.com", EmailSubject, "NoGitActivity");
      return;

    } else if (responce.data.length > 0) {

      const pushEvents = responce.data.filter(event => event.type = 'PushEvent');
      const lastPushEventDate = DateTime.fromISO(pushEvents[0].created_at);
      const numOfDaysSincePush = Math.floor(Math.abs(lastPushEventDate.diffNow('day').values.days));

      if (numOfDaysSincePush > 0) {
        console.log("User has no github activity today.");
        const currentDate = DateTime.local().toLocaleString();
        const EmailSubject = `${currentDate}, No Git Activity Today`;
        const semiDesapointedEmail = `<h2>Dear ${userName}</h2><p>You currently have no github activity for today.</p><p>Your last push to github was ${numOfDaysSincePush} day(s) ago.</p><p>You can view your current github activity <a href="https://github.com/${userName}">HERE</a></p>`;
        sendEmail(semiDesapointedEmail, "samuel@codeup.com", EmailSubject, "NoGitActivityToday");
      }

      console.log(`No action needed for ${userName}, activity was found for today.`);

    }



  }))
}





cron.schedule('50 16 * * Monday,Tuesday,Wednesday,Thursday,Friday', () => {
  checkGitHubActivity("samuelmoorec");
  console.log('running a task every week day at 4:50pm');
});