'use strict';

var plugin = require('../');

var FastApi = plugin.FastApi;
var DataObject = plugin.DataObject;

FastApi.configure("http://fast-api.dev");

/*
var req = FastApi.get('users', {email:'contact@alexchastan.fr'});

req.then(function(users){ console.log( users ); });
//*/
/*
var user = new DataObject('users', {id:19, pwd:'121989'});

FastApi.update(user).then(function (value) { console.log(value) });
//*/

