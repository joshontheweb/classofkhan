var express = require('express'),
    _ = require('underscore');

// underscore template languate settings
_.templateSettings = {
    interpolate : /\{\{(.+?)\}\}/g, // {{ var }}
    evaluate: /\{\%(.+?)\%\}/g // {% expression %}
}; 

var conf = require('./conf');

var everyauth = require('everyauth')
  , Promise = everyauth.Promise
  ,  mongooseAuth = require('mongoose-auth');

everyauth.debug = true;

var mongoose = require('mongoose')
  , Schema = mongoose.Schema
  , ObjectId = mongoose.SchemaTypes.ObjectId;

var UserSchema = new Schema({})
  , User;


UserSchema.plugin(mongooseAuth, {
    everymodule: {
      everyauth: {
          User: function () {
            return User;
          }
      }
    }
  , facebook: {
      everyauth: {
          myHostname: 'http://local.host:3000'
        , appId: conf.fb.appId
        , appSecret: conf.fb.appSecret
        , redirectPath: '/'
      }
    }
  , twitter: {
      everyauth: {
          myHostname: 'http://local.host:3000'
        , consumerKey: conf.twit.consumerKey
        , consumerSecret: conf.twit.consumerSecret
        , redirectPath: '/'
      }
    }
  , password: {
        loginWith: 'email'
      , extraParams: {
            phone: String
          , name: {
                first: String
              , last: String
            }
        }
      , everyauth: {
            getLoginPath: '/login'
          , postLoginPath: '/login'
          , loginView: 'login.jade'
          , getRegisterPath: '/register'
          , postRegisterPath: '/register'
          , registerView: 'register.jade'
          , loginSuccessRedirect: '/'
          , registerSuccessRedirect: '/'
        }
    }
  , github: {
      everyauth: {
          myHostname: 'http://local.host:3000'
        , appId: conf.github.appId
        , appSecret: conf.github.appSecret
        , redirectPath: '/'
      }
    }
  , instagram: {
      everyauth: {
          myHostname: 'http://local.host:3000'
        , appId: conf.instagram.clientId
        , appSecret: conf.instagram.clientSecret
        , redirectPath: '/'
      }
    }
});

mongoose.model('User', UserSchema);

var ProjectSchema = new Schema({
    ownerId: ObjectId,
    title: String,
    media: String,
    slug: String,
});

// create slug from title on save
ProjectSchema.pre('save', function (next) {
  this.slug = this.title.toLowerCase().replace(/ /g, '-');
  next();
});

mongoose.model('Project', ProjectSchema);

var DonationSchema = new Schema({
    projectId: ObjectId,
    donorId: ObjectId,
    amount: Number
});

mongoose.model('Donation', DonationSchema);

mongoose.connect('mongodb://localhost/alumni');

User = mongoose.model('User');
Project = mongoose.model('Project');

var app = express.createServer(
    express.bodyParser()
  , express.cookieParser()
  , express.session({ secret: '$3CR3#'})
  , mongooseAuth.middleware()
);

app.use('/media', express.static(__dirname + '/media'));

app.configure( function () {
  app.set('views', __dirname + '/templates');
});

app.register('.html', {
    compile: function (str, options) {
        var template = _.template(str);
        return function (locals) {
          return template(locals);
        };
    }
});

app.get('/', function (req, res) {
    var templateVars = {};
    Project.find({}, function(err, projects) {
        templateVars.projects = projects;
        res.render('index.html', templateVars);
    });
});

app.get('/:projectSlug', function (req, res) {
    var templateVars = {};
    Project.findOne({slug: req.params.projectSlug}, function(err, project) {
        if (!project) { return res.render('404.html') }
        templateVars.project = project;

        User.findOne({_id: project._doc.userId}, function(err, owner) {
            templateVars.owner = owner;
            res.render('project.html', templateVars);
        });
    });
});

app.get('/logout', function (req, res) {
    req.logout();
    res.redirect('/');
});

// testing route...  should use front end url routing in the end
app.get('/some-project', function (req, res) {
  res.render('project.html');
});

mongooseAuth.helpExpress(app);

app.listen(3000);

var io = require('socket.io').listen(3001);

io.sockets.on('connection', function (socket) {
  socket.emit('news', { hello: 'world' });
  socket.on('my other event', function (data) {
    console.log(data);
  });
  
  socket.on('my other event', function (data) {
    console.log(data);
  });
  
  socket.on('project:create', function (data) {
    console.log(data);
    var project = new Project(data);
    project.save();
  });
});
