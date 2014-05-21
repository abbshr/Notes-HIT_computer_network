var dgram = require('dgram');
var dgram_send = dgram.createSocket('udp4');

var target = {
  PORT: process.argv[3] || 3000,
  ADDRESS: process.argv[2] || '127.0.0.1'
};
var origin = {
  PORT: 8888,
  ADDRESS: 'localhost'
};

var timeout_flag = null,  /* use timeout to check network env */
    ref = 1,              /* times for timeout retry */
    sent = false;         /* if data has been sent */

var buf = null,           /* buffer to send */
    input = null;         /* utf-8 string from standard input */

//var seq = new Buffer(1);
//seq.writeInt8(1);         /* seq for packet */

/* handle input inside an event loop */
process.stdin.on('readable', init);
process.stdin.setEncoding('utf8');

/* on reciving message from reciver */
dgram_send.on('message', function (msg, rinfo) {
  clearTimeout(timeout_flag);
  msg = msg.toString('utf8');
  console.log('recive:', msg);
  // continue read from stdio & set timeout to 5s
  switch (msg) {
    case 'a':
      sent = false;
      process.stdin.resume();
      break;
    case 'b':
    case 'c':
      console.log('retry now...');
      sent = true;
      process.stdin.pause();
      dgram_send.send(buf, 0, buf.length, target.PORT, target.ADDRESS);
      timeout_flag = setTimeout(timeout_cb, 1000 * 5);
      break;
    default:
      sent = false;
      process.stdin.resume();
  }
});

// block the process & waiting for recv
dgram_send.bind(origin.PORT);

// init process send a msg & set a timeout
function init() {
  if (sent) return process.stdin.pause();
  input = process.stdin.read();
  if (!input) return;
  buf = new Buffer(input);
  Array.prototype.pop.call(buf);
  /* seq: 0/1 */
  //seq.writeInt8(++seq.readInt8(0) % 2);
  /* concat an seq to buf */
  //buf = Buffer.concat([seq, buf]);
  dgram_send.send(buf, 0, buf.length, target.PORT, target.ADDRESS);
  timeout_flag = setTimeout(timeout_cb, 1000 * 5);
  sent = true;
}

function timeout_cb() { 
  clearTimeout(timeout_flag);
  if (ref > 5) console.log('network blocking...'), ref = 1;
  dgram_send.send(buf, 0, buf.length, target.PORT, target.ADDRESS);
  timeout_flag = setTimeout(arguments.callee, 1000 * 5);
  ref++;
}