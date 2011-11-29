var express = require('express'),
    _ = require('underscore');

// underscore template languate settings
// _.templateSettings = {
//     interpolate : /\{\{(.+?)\}\}/g, // {{ var }}
//     evaluate: /\{\%(.+?)\%\}/g // {% expression %}
// }; 

var conf = require('./conf');

var mongooseAuth = require('mongoose-auth');

var mongoose = require('mongoose'),
    conf = require('./conf'),
    mongooseAuth = require('mongoose-auth'),
    Schema = mongoose.Schema,
    ObjectId = mongoose.SchemaTypes.ObjectId;


var User;

var UserSchema = new Schema({
        username: String
});



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
          myHostname: conf.hostname
        , appId: conf.fb.appId
        , appSecret: conf.fb.appSecret
        , redirectPath: '/'
      }
    }
  , twitter: {
      everyauth: {
          myHostname: conf.hostname
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
          myHostname: conf.hostname
        , appId: conf.github.appId
        , appSecret: conf.github.appSecret
        , redirectPath: '/'
      }
    }
  , instagram: {
      everyauth: {
          myHostname: conf.hostname
        , appId: conf.instagram.clientId
        , appSecret: conf.instagram.clientSecret
        , redirectPath: '/'
      }
    }
});

UserSchema.pre('save', function(next) {
    this.username = this._doc.twit.screenName || this._doc.fb.username;
    next();
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


mongoose.connect('mongodb://localhost/classofkhan');

User = mongoose.model('User');
Project = mongoose.model('Project');

var app = express.createServer(
    express.bodyParser(),
    express.cookieParser(),
    express.session({ secret: '$3CR3#'}),
    mongooseAuth.middleware()
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
    var template = req.loggedIn ? 'index.html' : 'login.html';
    res.render(template, templateVars);
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

mongooseAuth.helpExpress(app);

app.listen(conf.port);

var io = require('socket.io').listen(conf.port+1);

var users = []

io.sockets.on('connection', function (socket) {
    socket.emit('connected', {users: users});
    
    socket.on('join', function(data) {
        User.findOne({username: data.username}, function(err, user) {
            socket.set('user', user);
            users.push(user);
            io.sockets.emit('joined', user);
        });
    });
    
    socket.emit('news', { hello: 'world' });
  
    socket.on('chat', function (data) {
        console.log(data);
        socket.get('user', function(err, user) {
            socket.broadcast.emit('chat', {content: data.content, 'username': user.username});
        });
    });

    socket.on('disconnect', function(data) {
        socket.get('user', function(err, user) {
            var index = users.indexOf(user);
            if (index > -1) { users.splice(index, 1) }
            
            if (user) {
                socket.broadcast.emit('disconnected', user);
            }
        });
    });
});




