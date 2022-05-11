"use strict";

// const fs = require('fs');
const sgMail = require("@sendgrid/mail");
var cron = require("node-cron");
const { Octokit } = require("@octokit/core");
const { DateTime } = require("luxon");
const axios = require("axios");
require("dotenv").config();

const credentials = {
  githubApiKey: process.env.GITHUB_API_KEY,
  sendGridApiKey: process.env.SEND_GRID_API_KEY,
  hostEmailName: process.env.HOST_EMAIL_NAME,
  toolsAppBearerToken: process.env.TOOLS_APP_BEARER_TOKEN,
};
const octokit = new Octokit({ auth: credentials.githubApiKey });

let cohorts;

const buildEmail = (
  htmlBody,
  recipentsEmail,
  emailSubject = "GitHub Activity Status"
) => {
  const msg = {
    to: recipentsEmail,
    from: credentials.hostEmailName,
    subject: emailSubject,
    html: htmlBody,
  };

  return msg;
};

const sortByUrgency = (studentStatsOne, studentStatsTwo) =>
  studentStatsTwo.daysSincePush - studentStatsOne.daysSincePush;

const RequestStudentActivity = (githubUsername) => {
  return octokit.request("GET /users/{username}/events", {
    username: githubUsername,
  });
};

const retrieveCohortEmailContent = (cohort) => {
  const currentDate = DateTime.local().toLocaleString();

  return getAllGithubActivityStats(cohort).then((studentGithubStats) => {
    studentGithubStats.sort(sortByUrgency);

    let emailbody = `<h2>Today's Github Activity Status</h2>`;
    let emailAddress;
    if (cohort.name === `Regulus` || cohort.name === `Sirius`) {
      emailAddress = `${cohort.name.toLowerCase()}-staff@codeup.com`
    } else {
      emailAddress = `staff-${cohort.name.toLowerCase()}@codeup.com`
    }

    studentGithubStats.forEach(
      (result) => (emailbody += buildEmailBody(result))
    );

    emailbody += `<p>If you notice any <strong>bugs or inconsistent</strong> results please report them to <a href="mailto:ry.sutton@codeup.com">ry.sutton@codeup.com</a>.</p>`;
    console.log(emailAddress)
    return buildEmail(
      emailbody,
      emailAddress,
      `${currentDate}, ${cohort.name} Github Activity`,
      `${cohort.name} Github Activity Notifier`
    );
  });
};

// VERSION OF FUNCTION FOR SENDING STUDENT EMAILS
const retrieveCohortStudentsEmailContent = (cohort) => {
  const currentDate = DateTime.local().toLocaleString();

  return getAllGithubActivityStats(cohort).then((studentGithubStats) => {
    studentGithubStats.sort(sortByUrgency);

    let emailbody;
    return studentGithubStats.map(studentData => {

      emailbody = buildStudentEmailBody(studentData)

      if (emailbody !== '') {
        return buildEmail(
          emailbody,
          `${studentData.email}`,
          `${currentDate}, Github Activity for ${studentData.name}`,
          `${cohort.name} Github Activity Notifier`
        )
      }
    }

    );
  });
};

const checkCohortsGithubActivity = (cohortName) => {
  let cohort = cohorts.filter((cohort) => cohort.name === cohortName)[0];

  return retrieveCohortEmailContent(cohort);
};

// VERSION OF FUNCTION FOR SENDING STUDENT EMAILS
const checkCohortsStudentGithubActivity = (cohortName) => {
  let cohort = cohorts.filter((cohort) => cohort.name === cohortName)[0];

  return retrieveCohortStudentsEmailContent(cohort);
};

const getAllGithubActivityStats = (cohort) => {
  const { users } = cohort;

  return Promise.all(
    users.map((student) => {
      const { name, github_username, email } = student;

      return getGitHubActivityStats(github_username).then((result) => {
        return { ...result, name: name, email: email };
      });
    })
  );
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
};

const buildEmailBody = (githubResult) => {
  const paragraphTagStyling = `style="background-color: #dddddd; padding: 5px; font-family: system-ui, sans-serif; display: inline-block; border-radius: 5px;"`;

  switch (githubResult.daysSincePush) {
    case 0:
      // return `<p ${paragraphTagStyling}>${githubResult.name} pushed yesterday.</p><br>`;
      return ``;
    case "no_activity":
      return `<p ${paragraphTagStyling}>${githubResult.name} currently has no github activity in the past year!!.</p><a href="https://github.com/${githubResult.username}">${githubResult.name}'s github</a></p><br>`;
    default:
      return `<p ${paragraphTagStyling}>${githubResult.name
        }'s last push to github was <span ${severityColorPicker(
          githubResult.daysSincePush
        )}>${githubResult.daysSincePush
        }</span> days ago. <a href="https://github.com/${githubResult.username
        }">${githubResult.name}'s github</a></p><br>`;
  }
};

// VERSION OF FUNCTION FOR SENDING STUDENT EMAILS
const buildStudentEmailBody = (githubResult) => {
  const paragraphTagStyling = `style="background-color: #dddddd; padding: 5px; font-family: system-ui, sans-serif; display: inline-block; border-radius: 5px;"`;

  switch (githubResult.daysSincePush) {
    case 0:
      return ``;
    case "no_activity":
      return `<p ${paragraphTagStyling}>${githubResult.name}, you have no github activity in the past year!!.</p><a href="https://github.com/${githubResult.username}">${githubResult.name}'s github</a></p><br>`;
    default:
      return `
      <h3>NOTE:</h3>
      <p>This message is just a friendly reminder not a punishment or call out!</p>
      <h3>Keep the following in mind:</h3>
      <p>Contributions to FORKED or PRIVATE repositories will NOT count as contributions for this email service. <br>
      You may see them show up in your contribution tracker (green squares) but they're only visible to you as the profile owner. (You can also show private contributions with a setting in 'Contribution Settings'). <br>
      If you're working on AdLister, any other project that involves a forked repository, or your project repository is set to private, it will show as though you haven't been pushing to github. <br> 
      If that's the case for you and you know you've been pushing, then don't worry about it :)</p>
      <p ${paragraphTagStyling}>${githubResult.name
        }, your last push to github was <span ${severityColorPicker(
          githubResult.daysSincePush
        )}>${githubResult.daysSincePush
        }</span> days ago.</p>
      <br>
      <p>View your github:<a href="https://github.com/${githubResult.username
        }">${githubResult.name}</a></p><br>
      <p>Make sure you're committing and pushing everyday!</p>`;
  }
};

const getGitHubActivityStats = (userName) => {
  return RequestStudentActivity(userName).then((response) => {
    if (response.data.length == 0) {
      return { username: userName, daysSincePush: "no_activity" };
    } else if (response.data.length > 0) {
      const pushEvents = response.data.filter(
        (event) => (event.type = "PushEvent")
      );
      const lastPushEventDate = DateTime.fromISO(pushEvents[0].created_at);
      const numOfDaysSincePush = Math.floor(
        Math.abs(lastPushEventDate.diffNow("day").values.days)
      );
      const yesterdaysDate = DateTime.local()
        .plus({ days: -1 })
        .toLocaleString();

      if (!lastPushEventDate.hasSame(yesterdaysDate, "day")) {
        if (numOfDaysSincePush === 0) {
          return { username: userName, daysSincePush: 0 };
        } else {
          return { username: userName, daysSincePush: numOfDaysSincePush };
        }
      } else {
        console.log(
          `No action needed for ${userName}, activity was found for today.`
        );
      }
    }
  });
};

const buildAllEmails = () => {
  return fetchActiveCohorts().then((res) => {
    cohorts = res;

    return Promise.all(
      cohorts.map((cohort, index) => {
        return new Promise(function (resolve) {
          setTimeout(function () {
            resolve(checkCohortsGithubActivity(cohort.name));
          }, 1000 * index);
        });
      })
    );
  });
};
// VERSION OF FUNCTION FOR SENDING STUDENT EMAILS
const buildAllStudentsEmails = () => {
  return fetchActiveCohorts().then((res) => {
    cohorts = res;

    return Promise.all(
      cohorts.map((cohort, index) => {
        return new Promise(function (resolve) {
          setTimeout(function () {
            resolve(checkCohortsStudentGithubActivity(cohort.name));
          }, 1000 * index);
        });
      })
    );
  });
};

const sendAllEmails = (emails) => {
  sgMail.setApiKey(credentials.sendGridApiKey);

  sgMail
    .sendMultiple(emails)
    .then(() => {
      console.log("Emails sent");
    })
    .catch((error) => {
      console.error(error);
    });
};

const MainBoi = () => {
  buildAllEmails().then((emailsToSend) => {
    sendAllEmails(emailsToSend);
  });
  buildAllStudentsEmails().then((emailsToSend) => {
    let combinedArray = [];
    emailsToSend.forEach(function (array) {
      combinedArray.push(...array);
    });
    emailsToSend = combinedArray.filter((email) => email !== undefined);
    sendAllEmails(emailsToSend);
  })
};

function fetchActiveCohorts() {
  return axios
    .get("https://tools.codeup.com/api/cohorts", {
      headers: {
        Authorization: `Bearer ${credentials.toolsAppBearerToken}`,
      },
    })
    .then(function (response) {
      return response.data.filter((cohort) => {
        const startDate = DateTime.fromSQL(cohort.start_date);
        const endDate = DateTime.fromSQL(cohort.end_date);

        if (
          startDate < DateTime.local() &&
          DateTime.local() < endDate &&
          cohort.program_id === 2 &&
          cohort.slack !== "#null"
        ) {
          cohort.users = cohort.users.filter((student) => {
            return !student.access_removed_at;
          });

          return cohort;
        }
      });
    })
    .catch(function (error) { });
}

cron.schedule('0 8 * * Monday,Tuesday,Wednesday,Thursday,Friday', () => {
  MainBoi();
});