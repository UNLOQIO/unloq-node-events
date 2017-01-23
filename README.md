# UNLOQ.io Node.js module for real-time UNLOQ events
## Full documentation will be available soon

### Full docs: https://docs.unloq.io

#### Example available in folder example/

##### Usage:
~~~~
const UnloqEvents = require('unloq-events');

const client = new UnloqEvents({
  key: 'YOUR_API_KEY'
});

// Subscribe to namespace modifications (eg: IAM & Permission changes)
clientObj
  .subscribe(clientObj.NAMESPACE.IAM, (data) => {
    console.log(`Event occurred: ${data.type}`);
    console.log(data.payload);
  }).catch((e) => {
    console.warn(`Something bad happened`, e);
  });
  
setTimeout(() => {
  // Or ubsibscribe from a namespace
  clientObj.unsubscribe(clientObj.NAMESPACE.IAM);
}, 5000);

// OR have a specific subscription
function onEvent(data) {
  console.log(`Received: ${data.type}`):
  console.log(data.payload);
}
clientObj.subscribe(clientObj.NAMESPACE.IAM, /permission\.save/g, onEvent);

// Or unsubscribe a specific callback
setTimeout(() => {
  clientObj.unsubscribe(clientObj.NAMESPACE.IAM, onEvent);
}, 3000);
  
clientObj.on('error', (e) => {
  console.log("Error", e);
});
~~~~

#### Current supported namespaces:
`
NAMESPACE.IAM // namespace for IAM & Permissions
`
