require('dotenv').config();
const { handler } = require('./netlify/functions/generate-articles');

handler({}).then(result => {
  console.log(JSON.parse(result.body));
});
