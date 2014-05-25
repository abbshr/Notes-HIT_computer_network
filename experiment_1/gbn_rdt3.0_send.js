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
var input = null;

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
  // recive legall ack_seq num
  if (base <= ack_seq && nextseqnum > ack_seq) {
    // window slide to 'ack_seq + 1'
    buffer_window = buffer_window.slice(ack_seq - base + 1);
    base = ack_seq + 1;
    clearTimeout(timeout_flag);
    // is there are packet not acked, restart the timer
    if (base != nextseqnum) 
      timeout_flag = setTimeout(timeout_cb, 1000 * S);
    process.stdin.resume();
  } 
  /* else do nothing*/
});

// block the process & waiting for recv
dgram_send.bind(origin.PORT);

// init process send a msg & set a timeout
function handle_input_cb() {
  // if input buffered size over window size, locked
  console.log(nextseqnum, base);
  if (nextseqnum > base + N - 1) {
    console.log('has been up to max window size limit');
    return process.stdin.pause();
  }
  input = process.stdin.read();
  if (!input) return;
  input = new Buffer(input);
  // get the data
  Array.prototype.pop.call(input);
  /* segment struct:
  * |1 byte seq|---data---|
  */
  // concat with the seqnum
  var buf_nextseqnum = new Buffer(1);
  buf_nextseqnum.writeUInt8(nextseqnum, 0);
  var buf = Buffer.concat([buf_nextseqnum, input]);
  // start random sender
  var rd = random();
  if (rd == 'SEND_ORIGIN_MSG')
    dgram_send.send(buf, 0, buf.length, target.PORT, target.ADDRESS);
  if (rd == 'SEND_GEN_MSG') {
    var wnextseqnum = new Buffer(1);
    wnextseqnum.writeUInt8((nextseqnum + 1) % (2 << (k - 1)), 0);
    var wbuf = Buffer.concat([wnextseqnum, input]);
    dgram_send.send(wbuf, 0, wbuf.length, target.PORT, target.ADDRESS);
  } 
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
  console.log('timeout, resending...');
  if (ref > 5) console.log('network blocking...'), ref = 1;
  // resend all buffered packet
  buffer_window.forEach(function (buf, i) {
    dgram_send.send(buf, 0, buf.length, target.PORT, target.ADDRESS);
  });
  timeout_flag = setTimeout(arguments.callee, 1000 * S);
  ref++;
}

/* random send tool, control sending
*  10% timeout
*  50% send the correct seqnum packet
*  30% send the incorrect seqnum packet
*/
function random() {
  var num = parseInt(Math.random() * 10);
  if (num < 5) return 'SEND_ORIGIN_MSG';
  if (num < 8) return 'SEND_GEN_MSG';
  return 'TIMEOUT_NOT_SEND';
}