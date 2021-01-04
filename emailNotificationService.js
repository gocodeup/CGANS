'use strict';

const fs = require('fs');
var nodemailer = require('nodemailer');
var cron = require('node-cron');
const { Octokit } = require("@octokit/core");

const credentials = JSON.parse(fs.readFileSync('credentials.json'));
const octokit = new Octokit({ auth: credentials.githubApiKey });

var transporter = nodemailer.createTransport({
  service: 'outlook',
  auth: {
    user: credentials.hostEmailName,
    pass: credentials.hostEmailPass
  }
});

let message = `<h1>Hello there,</h1><p>We have noticed that you have no github activity for today, please commit your changes from today and push them to github.</p>`


var mailOptions = {
  from: credentials.hostEmailName,
  to: 'samuel@codeup.com',
  subject: 'GitHub Activity Reminder',
  html: message
};


const DatesOnSameDay = (dateOne,dateTwo) =>{
  return dateOne.toLocaleDateString() == dateTwo.toLocaleDateString();
}



const ReqStudentActivity = (gitHubUserName) =>{
  return octokit.request('GET /users/{username}/events',{
    username: gitHubUserName
  })
}

const didStudentPushToday = (userName) =>{
  ReqStudentActivity(userName).then((responce =>{
    pushEvents = responce.data.filter(event => event.type = 'PushEvent')
    todaysDate = new Date();
    lastPushEventDate = new Date(pushEvents[0].created_at);
    return DatesOnSameDay(todaysDate,lastPushEventDate);
  }))
}





cron.schedule('50 16 * * Monday,Tuesday,Wednesday,Thursday,Friday', () => {
  if(!didStudentPushToday("samuelmoorec")){
  transporter.sendMail(mailOptions, function(error, info){
    if (error) {
      console.log(error);
    } else {
      console.log('Email sent: ' + info.response);
    }
  });
  }
  console.log('running a task every week day at 4:50pm');
});