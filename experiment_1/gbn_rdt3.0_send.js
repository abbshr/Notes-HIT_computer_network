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

// minuim not verify seqnum
var base = 0;
// next seqnum
var nextseqnum = 0;
// window size, default to 10
var N = 10;
// seqnum segment size, 
// N <= 2 ^k - 1, default to 8 (1 byte)
var k = 8;

// buffer window
var buffer_window = [];

// standard input stream
var input = null,
    buf = null;

// timeout flag
var timeout_flag;
// timeout seconds
var S = 10;
// times for timeout retry
var ref = 1;

/* handle input inside an event loop */
process.stdin.on('readable', handle_input_cb);
process.stdin.setEncoding('utf8');

/* on reciving msg from reciver */
dgram_send.on('message', function (msg, rinfo) {
  // resolve seqnum
  var ack_seq = msg.readUInt8(0);
  // resolve data
  msg = msg.slice(1).toString('utf8');
  
  // continue read from stdio & set timeout to 5s
  switch (msg) {
    // means an 'ACK'
    case 'a':
      console.log('recive:', msg, ', ack_seq:', ack_seq);
      if (base <= ack_seq && nextseqnum > ack_seq) {
        // window slide to 'ack_seq + 1'
        buffer_window = buffer_window.slice(ack_seq - base + 1);
        base = ack_seq + 1;
        clearTimeout(timeout_flag);
        // is there are packet not acked, restart the timer
        if (base != nextseqnum) 
          timeout_flag = setTimeout(timeout_cb, 1000 * S);
        process.stdin.resume();
        break;
      }
    // means request timeout or false ACK
    default:
      console.log('request timeout & now resending packet...');
      //sent = true;
      process.stdin.pause();
      // resend all buffered packet
      buffer_window.forEach(function (buf, i) {
        dgram_send.send(buf, 0, buf.length, target.PORT, target.ADDRESS);
      });
      // setting timeout for the first-not-acked packet
      timeout_flag = setTimeout(timeout_cb, 1000 * S);
      break;
  }
});

// block the process & waiting for recv
dgram_send.bind(origin.PORT);

// init process send a msg & set a timeout
function handle_input_cb() {
  // if input buffered size over window size, locked
  if (nextseqnum > base + N - 1) {
    console.log('has been up to max window size limit');
    return process.stdin.pause();
  }
  input = process.stdin.read();
  if (!input) return;
  buf = new Buffer(input);
  // get the data
  Array.prototype.pop.call(buf);
  /* segment struct:
  * |1 byte seq|---data---|
  */
  // concat with the seqnum
  var buf_nextseqnum = new Buffer(1);
  buf_nextseqnum.writeUInt8(nextseqnum, 0);
  buf = Buffer.concat([buf_nextseqnum, buf]);
  dgram_send.send(buf, 0, buf.length, target.PORT, target.ADDRESS);
  // buffered the current packet
  buffer_window[nextseqnum - base] = buf;
  // reset ref
  ref = 1;
  // setting timeout for the first-not-acked packet
  if (base == nextseqnum)
    timeout_flag = setTimeout(timeout_cb, 1000 * S);
  // increase nextseqnum in range [0, 2 ^k - 1]
  nextseqnum = ++nextseqnum % (2 << (k - 1));
}

function timeout_cb() { 
  clearTimeout(timeout_flag);
  if (ref > 5) console.log('network blocking...'), ref = 1;
  // resend all buffered packet
  buffer_window.forEach(function (buf, i) {
    dgram_send.send(buf, 0, buf.length, target.PORT, target.ADDRESS);
  });
  timeout_flag = setTimeout(arguments.callee, 1000 * S);
  ref++;
}