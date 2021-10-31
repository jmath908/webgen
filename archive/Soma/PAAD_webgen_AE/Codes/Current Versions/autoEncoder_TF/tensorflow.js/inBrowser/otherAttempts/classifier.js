//classifier.js

var model;
var predResult = document.getElementById("result");
async function initialize() {
    console.log('start initialize.')
    model = await tf.loadGraphModel('./model.json');
    console.log('model loaded.')
    predict();
}async function predict() {
  // action for the submit buttonlet image = document.getElementById("img")
    tf.env().set('WEBGL_CPU_FORWARD', false);
    let image = document.getElementById("img")  
    let tensorImg = tf.browser.fromPixels(image).expandDims(axis=0);
    let tensorImg_c = tf.cast(tensorImg,"float32").div(255);
    const verbose = true;       
    console.log(tensorImg_c)
    prediction = await model.predict(tensorImg_c).mul(255)
    console.log(prediction)
    reConstructed = await tf.node.encodePng(prediction)
  }
initialize();