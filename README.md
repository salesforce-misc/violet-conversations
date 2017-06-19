# violet-poc-alexa

A proof-of-concept building Amazon Skills. Skills are built as apps, with this
project consisting of the `einstein` skill. Each skill has multiple intents and
supports a set of utterances by the user.

## Setup

If you are using the Salesforce integration (as used by the Diabetes Script),
then you will need to set up the following environment variables (locally and on
any deployed platform): `V_SFDC_CLIENT_ID`, `V_SFDC_CLIENT_SECRET`,
`V_SFDC_USERNAME` and `V_SFDC_PASSWORD`.


## Local execution

Can be run locally to ensure no syntax errors and to view intent schemas (for
the interaction model) and supported utterances.

To run locally `npm install` followed by `npm start`
and view the einstein skill configuration information by going to
 http://localhost:8080/alexa/einstein

## Deploying the skill

Deploy the service (already has `Procfile` for deploying to `heroku`), and use
those settings to create a new skill at
https://developer.amazon.com/edw/home.html#/skills/list. The skill will be
using a `Custom Interaction Model`, will need values from the services skill
configuration page.

## Building from scratch

There is a step-by-step set of instructions that you can use here: [Create an Alexa skill in Node.Js and host it on Heroku](https://iwritecrappycode.wordpress.com/2016/04/01/create-an-alexa-skill-in-node-js-and-hosting-it-on-heroku/)
