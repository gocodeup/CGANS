'use strict';

const fs = require('fs');
const sgMail = require("@sendgrid/mail")
var nodemailer = require('nodemailer');
var cron = require('node-cron');
const { Octokit } = require("@octokit/core");
const { DateTime } = require("luxon");

const credentials = JSON.parse(fs.readFileSync('credentials.json'));
const octokit = new Octokit({ auth: credentials.githubApiKey });
const cohorts = JSON.parse(fs.readFileSync('cohorts.json'));


var transporter = nodemailer.createTransport({
  service: 'outlook',
  auth: {
    user: credentials.hostEmailName,
    pass: credentials.hostEmailPass
  }
});


const buildEmail = (htmlBody, recipentsEmail, emailSubject = "GitHub Activity Status", emailType) => {

  const msg = {
    to: recipentsEmail,
    from: credentials.hostEmailName,
    subject: emailSubject,
    html: htmlBody,
  };

  return msg
}

const sortByUrgency = (studentStatsOne,studentStatsTwo) => studentStatsTwo.daysSincePush - studentStatsOne.daysSincePush;

const RequestStudentActivity = (githubUsername) => {
  return octokit.request('GET /users/{username}/events', {
    username: githubUsername
  })
}

// const didStudentPushToday = (userName) => {
//   return RequestStudentActivity(userName).then((responce => {
//     const pushEvents = responce.data.filter(event => event.type = 'PushEvent')
//     const todaysDate = DateTime.local();
//     const lastPushEventDate = DateTime.fromISO(pushEvents[0].created_at);
//     console.log(todaysDate.toString());
//     console.log(lastPushEventDate.toString());
//     return dateOne.hasSame(dateTwo, 'day');
//   }))
// }

const retrieveCohortEmailContent = (cohort) => {

  const currentDate = DateTime.local().toLocaleString();

  getAllGithubActivityStats(cohort).then(studentGithubStats => {

    const emailHtmlFooter = `<p>If you notice any <strong>bugs or inconsistent</strong> results please report them to <a href="mailto:samuel@codeup.com">samuel@codeup.com</a>.</p>`;

    studentGithubStats.sort(sortByUrgency)

    let emailbody = `<h2>Today's git activity stutus</h2>`;

    studentGithubStats.forEach(result => emailbody += buildEmailBody(result));

    emailbody += emailHtmlFooter;

    return buildEmail(emailbody,cohort.email,`${currentDate}, ${cohort.name} Github Activity`, `${cohort.name} Github Activity Notifier`);
  });

}

const checkCohortsGithubActivity = (cohortName) => {

  let cohort = cohorts.filter(cohort => cohort.name === cohortName)[0]

  return retrieveCohortEmailContent(cohort);

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


const severityColorPicker = (daysSincePush) => {
  switch(daysSincePush){
    case 1:
      return `style="background-color: #e0c009; padding: 0 5px; border-radius: 5px;"`;
    case 2:
      return `style="background-color: #d18111; padding: 0 5px; border-radius: 5px;"`;
    default:
      return `style="background-color: #d14711; padding: 0 5px; border-radius: 5px;"`;
  }
}

const buildEmailBody = (githubResult) =>{

  const paragraphTagStyling = `style="background-color: #dddddd; padding: 5px; font-family: system-ui, sans-serif; display: inline-block; border-radius: 5px;"`;

  switch(githubResult.daysSincePush){
    case 0:
      return `<p ${paragraphTagStyling}>${githubResult.name} currently has not pushed to github today.</p><br>`;
    case "no_activity":
      return `<p ${paragraphTagStyling}>${githubResult.name} currently has no github activity in the past year!!.</p><a href="https://github.com/${githubResult.username}">${githubResult.name}'s github</a></p><br>`;
    default:
      return `<p ${paragraphTagStyling}>${githubResult.name}'s last push to github was <span ${severityColorPicker(githubResult.daysSincePush)}>${githubResult.daysSincePush}</span> days ago. <a href="https://github.com/${githubResult.username}">${githubResult.name}'s github</a></p><br>`;
  }
}

const getGitHubActivityStats = (userName) => {
  return RequestStudentActivity(userName).then((response => {

    if (response.data.length == 0) {

      const currentDate = DateTime.local().toLocaleString();
      const EmailSubject = `${currentDate}, No Github Activity`;
      const superDisapointedEmail = `<h2>Dear ${userName}</h2><p>You currently have no github activity, this is very concerning and can negativley impact your job search.</p><p>You can view your current github activity <a href="https://github.com/${userName}">HERE</a></p>`;
      return {"username":userName,"daysSincePush":"no_activity"};

    } else if (response.data.length > 0) {

      const pushEvents = response.data.filter(event => event.type = 'PushEvent');
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

const buildAllEmails =_=> {
  let emails = [];
  cohorts.forEach((cohort) => {

    emails = [...emails,checkCohortsGithubActivity(cohort.name)];

  });
  return emails;
}

const sendAllEmails = (emails) => {
  sgMail.sendMultiple(emails).then((success,failure) => {
    
  })
}


const MainBoi =_=> {

  let emailsToSend = buildAllEmails();
  
  sendAllEmails(emailsToSend);
}

MainBoi();



// await sendEmailToAllCohorts();

// checkCohortsGithubActivity("kalypso");

// checkGitHubActivity("douglas-codeup");



// cron.schedule('50 16 * * Monday,Tuesday,Wednesday,Thursday,Friday', () => {
//   checkGitHubActivity("samuelmoorec");
//   console.log('running a task every week day at 4:50pm');
// });