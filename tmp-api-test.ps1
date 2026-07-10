require('dotenv').config();
const axios = require('axios');
axios.get('http://localhost:3000/users/search')
  .then(res => { console.log('status', res.status); console.log(res.data); })
  .catch(err => { console.error('error', err.toString()); if (err.response) { console.error(err.response.status, err.response.data); }});
