'use strict';
/**
 * A small example on how to use UNLOQ.io's real-time event subscriptioning
 */
const UnloqEvents = require('../index.js');  // this is require('unloq-events');

const clientObj = new UnloqEvents({
  key: 'YOUR_UNLOQ_API_KEY' //or process.env.UNLOQ_KEY
});

clientObj
  .connect()
  .then(() => {
    console.log("CONNECTED");
    // Subscribe only for event types with "permission.save"
    clientObj.subscribe(clientObj.NAMESPACE.IAM, "permission.save", (data) => {
      console.log("GOT EVENT:", data.type);
      console.log("GOT PAYLOAD:", data.payload);
    });
    clientObj.subscribe(clientObj.NAMESPACE.IAM, (data) => {
      console.log("GOT Global event:", data.type);
      console.log("GOT PAYLOAD:", data.payload);
    })
    /*setTimeout(() => {
     clientObj.unsubscribe(clientObj.NAMESPACE.IAM);
     }, 3000);*/
  })
  .catch((e) => {
    // something went wrong.
    console.log(e);

  });

clientObj.on('error', (e) => {
  console.log(e);
});
