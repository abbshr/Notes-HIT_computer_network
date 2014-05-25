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
// timeout seconds
var S = 10;

var buf = null,           /* buffer to send */
    input = null;         /* utf-8 string from standard input */

// seq 0/1
var seqnum = 0;

/* handle input inside an event loop */
process.stdin.on('readable', init);
process.stdin.setEncoding('utf8');

/* on reciving message from reciver */
dgram_send.on('message', function (msg, rinfo) {
  clearTimeout(timeout_flag);
  // get the ack_seq in head
  var ack_seq = msg.readUInt8(0);
  // get signal
  console.log('recive ack_seq:', ack_seq);
  if (seqnum == (ack_seq + 1) % 2) {
    sent = false;
    process.stdin.resume(); 
  } else {
    // get a wrong ack_seq
    console.log('get a wrong ack_seq, resending...');
    sent = true;
    process.stdin.pause();
    dgram_send.send(buf, 0, buf.length, target.PORT, target.ADDRESS);
    timeout_flag = setTimeout(timeout_cb, 1000 * S);
  }
});

// block the process & waiting for recv
dgram_send.bind(origin.PORT);

// init process send a msg & set a timeout
function init() {
  if (sent) return process.stdin.pause();
  input = process.stdin.read();
  if (!input) return;
  input = new Buffer(input);
  Array.prototype.pop.call(input);
  /* seq: 0/1 */
  var buf_seqnum = new Buffer(1);
  buf_seqnum.writeUInt8(seqnum++, 0);
  /* concat an seq to buf */
  /* |1 byte seq|---data---| */
  buf = Buffer.concat([buf_seqnum, input]);
  // random send wrong seqnum packet
  var rd = random();
  if (rd == 'broken') {
    var wbuf = new Buffer(1);
    wbuf.writeUInt8((seqnum + 1) % 2, 0);
    wbuf = Buffer.concat([wbuf, input]);
    dgram_send.send(wbuf, 0, wbuf.length, target.PORT, target.ADDRESS);
  } 
  if (rd == 'ok')
    dgram_send.send(buf, 0, buf.length, target.PORT, target.ADDRESS);

  // once send packet, reset ref
  ref = 1;
  seqnum %= 2;
  timeout_flag = setTimeout(timeout_cb, 1000 * S);
  sent = true;
}

function timeout_cb() { 
  console.log('timeout, resend');
  clearTimeout(timeout_flag);
  if (ref > 5) console.log('network blocking...'), ref = 1;
  dgram_send.send(buf, 0, buf.length, target.PORT, target.ADDRESS);
  timeout_flag = setTimeout(arguments.callee, 1000 * S);
  ref++;
}

// packet loss 50%
function random() {
  var num = parseInt(Math.random() * 10);
  if (num < 3) return 'broken';
  if (num < 7) return 'ok';
  return 'timeout';
}