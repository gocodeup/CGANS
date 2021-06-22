'use strict';

// const fs = require('fs');
const sgMail = require("@sendgrid/mail")
var cron = require('node-cron');
const { Octokit } = require("@octokit/core");
const { DateTime } = require("luxon");
const axios = require('axios');
require('dotenv').config();



const credentials = {
  githubApiKey: process.env.GITHUB_API_KEY,
  sendGridApiKey: process.env.SEND_GRID_API_KEY,
  hostEmailName: process.env.HOST_EMAIL_NAME,
  toolsAppBearerToken: process.env.TOOLS_APP_BEARER_TOKEN
};
const octokit = new Octokit({ auth: credentials.githubApiKey });

let cohorts;


const buildEmail = (htmlBody, recipentsEmail, emailSubject = "GitHub Activity Status", emailType) => {

  const msg = {
    to: recipentsEmail,
    from: credentials.hostEmailName,
    subject: emailSubject,
    html: htmlBody,
  };

  return msg
}

const sortByUrgency = (studentStatsOne, studentStatsTwo) => studentStatsTwo.daysSincePush - studentStatsOne.daysSincePush;

const RequestStudentActivity = (githubUsername) => {
  return octokit.request('GET /users/{username}/events', {
    username: githubUsername
  })
}

const retrieveCohortEmailContent = (cohort) => {

  const currentDate = DateTime.local().toLocaleString();

  return getAllGithubActivityStats(cohort).then(studentGithubStats => {

    const emailHtmlFooter = `<p>If you notice any <strong>bugs or inconsistent</strong> results please report them to <a href="mailto:samuel@codeup.com">samuel@codeup.com</a>.</p>`;

    studentGithubStats.sort(sortByUrgency)

    let emailbody = `<h2>Today's Github Activity Status</h2>`;

    studentGithubStats.forEach(result => emailbody += buildEmailBody(result));

    emailbody += emailHtmlFooter;

    return buildEmail(emailbody, cohort.email, `${currentDate}, ${cohort.name} Github Activity`, `${cohort.name} Github Activity Notifier`);
  });

}

const checkCohortsGithubActivity = (cohortName) => {

  let cohort = cohorts.filter(cohort => cohort.name === cohortName)[0]

  return retrieveCohortEmailContent(cohort);

}

const getAllGithubActivityStats = (cohort) => {
  const { users } = cohort;
  return Promise.all(users.map((student, index) => {


    console.log(index + "BOI")
    const { name, github_username } = student;
    return getGitHubActivityStats(github_username).then(result => {
      return { ...result, "name": name }
    })


  }))
};


const severityColorPicker = (daysSincePush) => {
  switch (daysSincePush) {
    case 1:
      return `style="background-color: #e0c009; padding: 0 5px; border-radius: 5px;"`;
    case 2:
      return `style="background-color: #d18111; padding: 0 5px; border-radius: 5px;"`;
    default:
      return `style="background-color: #d14711; padding: 0 5px; border-radius: 5px;"`;
  }
}

const buildEmailBody = (githubResult) => {

  const paragraphTagStyling = `style="background-color: #dddddd; padding: 5px; font-family: system-ui, sans-serif; display: inline-block; border-radius: 5px;"`;

  switch (githubResult.daysSincePush) {
    case 0:
      return `<p ${paragraphTagStyling}>${githubResult.name} currently has not pushed to github today.</p><br>`;
    case "no_activity":
      return `<p ${paragraphTagStyling}>${githubResult.name} currently has no github activity in the past year!!.</p><a href="https://github.com/${githubResult.username}">${githubResult.name}'s github</a></p><br>`;
    default:
      return `<p ${paragraphTagStyling}>${githubResult.name}'s last push to github was <span ${severityColorPicker(githubResult.daysSincePush)}>${githubResult.daysSincePush}</span> days ago. <a href="https://github.com/${githubResult.username}">${githubResult.name}'s github</a></p><br>`;
  }
}

const getGitHubActivityStats = (userName) => {

  console.log(userName)

  return RequestStudentActivity(userName).then((response => {



    if (response.data.length == 0) {

      const currentDate = DateTime.local().toLocaleString();
      const EmailSubject = `${currentDate}, No Github Activity`;
      const superDisapointedEmail = `<h2>Dear ${userName}</h2><p>You currently have no github activity, this is very concerning and can negativley impact your job search.</p><p>You can view your current github activity <a href="https://github.com/${userName}">HERE</a></p>`;
      return { "username": userName, "daysSincePush": "no_activity" };

    } else if (response.data.length > 0) {

      const pushEvents = response.data.filter(event => event.type = 'PushEvent');
      const lastPushEventDate = DateTime.fromISO(pushEvents[0].created_at);
      const numOfDaysSincePush = Math.floor(Math.abs(lastPushEventDate.diffNow('day').values.days));
      const currentDate = DateTime.local().toLocaleString();

      if (!lastPushEventDate.hasSame(currentDate, 'day')) {

        if (numOfDaysSincePush === 0) {
          return { "username": userName, "daysSincePush": 0 }
        } else {
          return { "username": userName, "daysSincePush": numOfDaysSincePush }
        }
      } else console.log(`No action needed for ${userName}, activity was found for today.`);

    }
  }))
}

const buildAllEmails = () => {
 


    let emails = [];


    fetchActiveCohorts().then(res => {

      cohorts = res

      cohorts.forEach((cohort, index) => {

        setTimeout(function () {

          emails = [...emails, checkCohortsGithubActivity(cohort.name)];

        }, 1000 * index)

      });

    });



  console.log(emails)

  
}

const sendAllEmails = (emails) => {

  sgMail.setApiKey(credentials.sendGridApiKey);

  sgMail.sendMultiple(emails)
    .then(() => {
      console.log('Emails sent')
    })
    .catch((error) => {
      console.error(error)
    })

  // })
}


const MainBoi = () => {

  Promise.all(buildAllEmails()).then(resolvedEmails => sendAllEmails(resolvedEmails))

}

MainBoi();


function fetchActiveCohorts() {



  return axios.get('https://tools.codeup.com/api/cohorts', {
    headers: {
      Authorization: `Bearer ${credentials.toolsAppBearerToken}`
    }
  })
    .then(function (response) {

      return response.data.filter(cohort => {
        const startDate = DateTime.fromSQL(cohort.start_date);
        const endDate = DateTime.fromSQL(cohort.end_date);

        if (startDate < DateTime.local() && DateTime.local() < endDate && cohort.program_id === 2 && cohort.slack !== "#null") {
          return cohort
        }

      })

    })
    .catch(function (error) {

    })


}



// console.log(fetchActiveCohorts().then(res => {
//   console.log(res)
// }))

// stuff.then(function(res){
//   console.log(res)
// })

// console.log(stuff)



// await sendEmailToAllCohorts();

// checkCohortsGithubActivity("kalypso");

// checkGitHubActivity("douglas-codeup");


// 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


// cron.schedule('50 16 * * Monday,Tuesday,Wednesday,Thursday,Friday', () => {
//   checkGitHubActivity("samuelmoorec");
//   console.log('running a task every week day at 4:50pm');
// });