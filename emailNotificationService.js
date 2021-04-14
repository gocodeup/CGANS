'use strict';

const fs = require('fs');
const sgMail = require("@sendgrid/mail")
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

const checkCohortsGithubActivity = (cohortName) => {
  const allCohorts = JSON.parse(fs.readFileSync('cohorts.json'));
  let cohort = allCohorts.cohorts.filter(cohort => cohort.name === cohortName)[0]
  const currentDate = DateTime.local().toLocaleString();

  getAllGithubActivityStats(cohort).then(studenGithubStats => {
    studenGithubStats.sort((a,b) => b.daysSincePush - a.daysSincePush)
    console.log(studenGithubStats)
    let emailbody = `<h2>Today's git activity stutus</h2>`;
    studenGithubStats.forEach(result => emailbody += buildEmailBody(result) );
    sendEmail(emailbody,cohort.email,`${currentDate}, ${cohort.name} Github Activity`, `${cohort.name} Github Activity Notifier`);
  });

  // cohortGithubResults.sort((a,b) => b.daysSincePush - a.daysSincePush)

  
  // console.log(cohortGithubResults)
}

const getAllGithubActivityStats = (cohort) => {
  const { students } = cohort;
  return Promise.all (students.map(student => {
    const { name, github } = student;
      return getGitHubActivityStats(github).then(result => {
        return {...result , "name":name}
    })
  }))
};


const buildEmailBody = (githubResult) =>{
  switch(githubResult.daysSincePush){
    case 0:
      return `<p>${githubResult.name} currently has no github activity for today.</p><p>${githubResult.name} last push to github was yesterday.</p><p><a href="https://github.com/${githubResult.username}">${githubResult.name}'s github</a></p><br>`;
    case "no_activity":
      return `<p>${githubResult.name} currently has no github activity in the past year!!.</p><a href="https://github.com/${githubResult.username}">${githubResult.name}'s github</a></p><br>`;
    default:
      return `<p>${githubResult.name}'s last push to github was ${githubResult.daysSincePush} days ago.</p><p><a href="https://github.com/${githubResult.username}">${githubResult.name}'s github</a></p><br>`;
  }
}


const checkGitHubActivity = (userName) => {
  ReqStudentActivity(userName).then((responce => {

    if (responce.data.length == 0) {

      console.log("User has no recent github activity!");
      const currentDate = DateTime.local().toLocaleString();
      const EmailSubject = `${currentDate}, No Github Activity`;
      const superDisapointedEmail = `<h2>Dear ${userName}</h2><p>You currently have no github activity, this is very concerning and can negativley impact your job search.</p><p>You can view your current github activity <a href="https://github.com/${userName}">HERE</a></p>`;
      sendEmail(superDisapointedEmail, "douglas@codeup.com", EmailSubject, "NoGitActivity");
      return;

    } else if (responce.data.length > 0) {

      const pushEvents = responce.data.filter(event => event.type = 'PushEvent');
      const lastPushEventDate = DateTime.fromISO(pushEvents[0].created_at);
      const numOfDaysSincePush = Math.floor(Math.abs(lastPushEventDate.diffNow('day').values.days));
      const currentDate = DateTime.local().toLocaleString();

      if (!lastPushEventDate.hasSame(currentDate, 'day')) {

        console.log("User has no github activity today.");
        let semiDesapointedEmail;
        const EmailSubject = `${currentDate}, No Git Activity Today`;

        if(numOfDaysSincePush === 0){
          semiDesapointedEmail = `<h2>Dear ${userName}</h2><p>You currently have no github activity for today.</p><p>Your last push to github was yesterday. Make sure you push your commits today!</p><p>You can view your current github activity <a href="https://github.com/${userName}">HERE</a></p>`;
        }else{
          semiDesapointedEmail = `<h2>Dear ${userName}</h2><p>You currently have no github activity for today.</p><p>Your last push to github was ${numOfDaysSincePush} day(s) ago.</p><p>You can view your current github activity <a href="https://github.com/${userName}">HERE</a></p>`;
        }
        sendEmail(semiDesapointedEmail, "douglas@codeup.com", EmailSubject, "NoGitActivityToday");
      }else console.log(`No action needed for ${userName}, activity was found for today.`);

      

    }
  }))
}

const getGitHubActivityStats = (userName) => {
  return ReqStudentActivity(userName).then((responce => {

    if (responce.data.length == 0) {

      const currentDate = DateTime.local().toLocaleString();
      const EmailSubject = `${currentDate}, No Github Activity`;
      const superDisapointedEmail = `<h2>Dear ${userName}</h2><p>You currently have no github activity, this is very concerning and can negativley impact your job search.</p><p>You can view your current github activity <a href="https://github.com/${userName}">HERE</a></p>`;
      return {"username":userName,"daysSincePush":"no_activity"};

    } else if (responce.data.length > 0) {

      const pushEvents = responce.data.filter(event => event.type = 'PushEvent');
      const lastPushEventDate = DateTime.fromISO(pushEvents[0].created_at);
      const numOfDaysSincePush = Math.floor(Math.abs(lastPushEventDate.diffNow('day').values.days));
      const currentDate = DateTime.local().toLocaleString();

      if (!lastPushEventDate.hasSame(currentDate, 'day')) {

        if(numOfDaysSincePush === 0){
          return {"username":userName,"daysSincePush":0}
        }else{
          return {"username":userName,"daysSincePush":numOfDaysSincePush}
        }
      }else console.log(`No action needed for ${userName}, activity was found for today.`);

    }
  }))
}

(async function sendEmailToAllCohorts(){
  const allCohorts = JSON.parse(fs.readFileSync('cohorts.json'));
  console.log(allCohorts);
  allCohorts.cohorts.forEach((cohort,index) => {

    setTimeout(() => checkCohortsGithubActivity(cohort.name), 3000 * (index + 1));

    
  });
  // let cohort = allCohorts.cohorts.filter(cohort => cohort.name === cohortName)[0]

  // allCohorts.cohorts.forEach(cohort,index => {
  //   setTimeout(() => checkCohortsGithubActivity(cohort.name), 1000 * (index + 1));
    
  // });
})()



// await sendEmailToAllCohorts();

// checkCohortsGithubActivity("kalypso");

// checkGitHubActivity("douglas-codeup");



// cron.schedule('50 16 * * Monday,Tuesday,Wednesday,Thursday,Friday', () => {
//   checkGitHubActivity("samuelmoorec");
//   console.log('running a task every week day at 4:50pm');
// });