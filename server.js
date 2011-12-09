var express = require('express'),
    _ = require('underscore'),
    http = require('http');

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

var RoomSchema = new Schema({
    title: String,
    slug: String,
    khanId: String,
});

RoomSchema.pre('save', function(next) {
    this.slug = this.title.toLowerCase().replace(/ /g, '-');
    next(); 
});

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
    if (req.loggedIn) {
        var options = {
            host: 'www.khanacademy.org',
            port: 80,
            path: '/api/' + conf.khanApiVersion + '/playlists'
        };
        
        http.get(options, function(response) {
            var str = ''
            response.on('data', function(data) {
                str = str + data
            });
            
            response.on('end', function() {
                templateVars.rooms = JSON.parse(str);
                _.each(templateVars.rooms, function(room) {
                    if (users[room.title]) {
                        room.count = users[room.title].length;
                    } else {
                        room.count = 0;
                    }
                });
                res.render('lobby.html', templateVars);
            });
        });
        
    } else {
        res.render('login.html', templateVars);
    }

    
});

// app.get('/:projectSlug', function (req, res) {
//     var templateVars = {};
//     Project.findOne({slug: req.params.projectSlug}, function(err, project) {
//         if (!project) { return res.render('404.html') }
//         templateVars.project = project;
// 
//         User.findOne({_id: project._doc.userId}, function(err, owner) {
//             templateVars.owner = owner;
//             res.render('project.html', templateVars);
//         });
//     });
// });

app.get('/room/:roomSlug', function (req, res) {
    var templateVars = {};

    var options = {
        host: 'www.khanacademy.org',
        port: 80,
        path: '/api/' + conf.khanApiVersion + '/playlists/' + encodeURI(req.params.roomSlug) + '/videos'
    };
        
    http.get(options, function(response) {
        var str = ''
        response.on('data', function(data) {
            str = str + data
        });
            
        response.on('end', function() {
            templateVars.videos = JSON.parse(str);
            templateVars.room = req.params.roomSlug;
            res.render('classroom.html', templateVars);
        });

    });
    
    // Project.findOne({slug: req.params.roomSlug}, function(err, project) {
    //     if (!project) { return res.render('404.html') }
    //     templateVars.project = project;
    // 
    //     User.findOne({_id: project._doc.userId}, function(err, owner) {
    //         templateVars.owner = owner;
    //         res.render('project.html', templateVars);
    //     });
    // });
});

app.get('/logout', function (req, res) {
    req.logout();
    res.redirect('/');
});

mongooseAuth.helpExpress(app);


var io = require('socket.io').listen(app);
app.listen(conf.port);

var users = {}

io.sockets.on('connection', function (socket) {
    socket.emit('connected');
    
    socket.on('join', function(data) {
        User.findOne({username: data.username}, function(err, user) {
            socket.join(data.room);
            socket.set('room', data.room);
            
            //create room if it doesn't exist yet
            users[data.room] = users[data.room] ? users[data.room] : []

            socket.set('user', user);
            users[data.room].push(user);
            socket.emit('joined', {users: users[data.room]});
            socket.broadcast.to(data.room).emit('joined', {users: [user]});
        });
    });
    
    socket.emit('news', { hello: 'world' });
  
    socket.on('chat', function (data) {
        console.log(data);
        socket.get('user', function(err, user) {
            socket.get('room', function(err, room) {
                socket.broadcast.to(room).emit('chat', {content: data.content, 'username': user.username});
            })
        });
    });

    socket.on('disconnect', function(data) {
        socket.get('user', function(err, user) {
            socket.get('room', function(err, room) {
                var index = users[room].indexOf(user);
                if (index > -1) { users[room].splice(index, 1) }

            
                if (user) {
                    socket.broadcast.to(room).emit('disconnected', user);
                }
                socket.leave(room)
            });
        });
    });
});




