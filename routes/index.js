var express = require('express');
var router = express.Router();

const stats = require('../services/stats');

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.get('/incident/:id', function(req, res, next){
  let cheatIncident = stats.getStats()["incidents"][req.params.id];
  if(!cheatIncident){
    return res.json({"status": 404});
  }
  else{
    return res.json({"status": 200, "data": cheatIncident});
  }
})

router.get('/stats', function(req, res, next){
  return res.json({"status": 200, "data": stats.getStats()})
})

router.get('/player/:id', function(req, res, next){
  let cheatIncident = stats.getStats()["players"][req.params.id];
  if(!cheatIncident){
    return res.json({"status": 404});
  }
  else{
    return res.json({"status": 200, "data": cheatIncident});
  }
})

module.exports = router;
