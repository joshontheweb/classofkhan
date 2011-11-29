(function() {
    Backbone.emulateHTTP = true;
    Backbone.emulateJSON = true;

    Backbone.Model.idAttribute = '_id';

    // underscore template languate settings
    _.templateSettings = {
      interpolate : /\{\{(.+?)\}\}/g, // {{ var }}
      evaluate: /\{\%(.+?)\%\}/g // {% expression %}
    };
    
    // don't start app until authenticated
    if (jsonVars.everyauth.loggedIn) {




        // Models
        var App = Backbone.Model.extend({
            defaults: {
                'user': null
            },
            
            start: function(data) {
                this.users = new Users();
                
                this.classRoom = new ClassRoom(data);
                this.classRoomView = new ClassRoomView({model: this.classRoom, el: $('.classroom')});
                this.classRoomView.render();

                this.chatLog = new ChatLog();
                this.chatLogView = new ChatLogView({model: this.chatLog})
                this.chatLogView.render();
            }
        });
        var AppView = Backbone.View.extend({
            events: {
                'keypress': 'keypress'
            },

            keypress: function(e) {
                var user = app.get('user');
                if (user && !user.get('chatting') && (e.keyCode != 13)) {
                    user.set({'chatting': e});
                }
            },
        });

        var User = Backbone.Model.extend({});
        var UserView = Backbone.View.extend({
            initialize: function() {
                _.bindAll(this, 'remove', 'handleChat');
                this.model.bind('remove', this.remove);
                this.model.bind('change:chatting', this.handleChat);
            },
            
            template: _.template($('.user-template').html()),

            className: 'user',

            handleChat: function(model, chatting) {
                var view = this;
                if (!chatting) { return; }
            
                var $user = $(this.el);
                var $chatBox = $('<textarea rows="10" cols="20" class="chat-box"></textarea>'); 
                $user.append($chatBox);
                $chatBox.focus();
                $chatBox.bind('keypress', function(e) {
                    if (e.keyCode == 13) {
                        e.preventDefault();
                        var message = new Message({content: $chatBox.val()})
                        app.chatLog.messages.add(message);
                        $chatBox.fadeOut(2000, function() {
                            $chatBox.remove();
                        });
                        view.model.set({'chatting': false});
                    }    
                })
            },
            
            render: function() {
                $(this.el).html(this.template(this.model.toJSON()));
                return this;
            }
        })

        var Users = Backbone.Collection.extend({
            model: User
        });
    
        var ClassRoom = Backbone.Model.extend({
            initialize: function() {
                this.desks = new Desks();
                
            }
        });
        
        var ClassRoomView = Backbone.View.extend({
            initialize: function() {
                _.bindAll(this, 'insertDesk', 'assignUserToDesk', 'removeUserFromDesk');
                this.model.desks.bind('add', this.insertDesk);
                app.users.bind('add', this.assignUserToDesk);
                app.users.bind('remove', this.removeUserFromDesk);
            },
            
            template: _.template($('.classroom-template').html()),

            insertDesk: function(desk) {
                var deskView = new DeskView({model: desk});
                this.$('.desks').append(deskView.render().el);
            },

            assignUserToDesk: function(user) {

                // set local user as main user of app
                if (user.id == jsonVars.user._id) {
                    app.set({'user': user});
                }

                // find the first empty desk
                var desk = this.model.desks.find(function(desk) {
                    return !desk.get('user');
                });

                // assign user to desk
                desk.trigger('addUser', user);
            },

            removeUserFromDesk: function(user) {
                // find the desk assigned to disconnected user
                var desk = this.model.desks.find(function(desk) {
                    return desk.get('user')._id == user._id
                });

                // unassign user
                desk.trigger('removeUser', user);
            },

            render: function() {
                $(this.el).html(this.template(this.model.toJSON()));

                for (i = 0; i < this.model.get('classSizeLimit'); i++) {
                    this.model.desks.add({});
                }
                
                return this;
            }
        });

        var Desk = Backbone.Model.extend({
            defaults: {
                user: null
            }
        });
        
        var DeskView = Backbone.View.extend({
            initialize: function() {
                _.bindAll(this, 'insertUser', 'removeUser');
                this.model.bind('addUser', this.insertUser);
                this.model.bind('removeUser', this.removeUser);
            },
            
            template: _.template($('.desk-template').html()),

            className: 'desk',
            
            insertUser: function(user) {
                
                this.model.set({'user': user})
                var userView = new UserView({model: user});
                $(this.el).append(userView.render().el).addClass(user.get('username'));
            },

            removeUser: function(user) {
                this.model.unset('user');
                $(this.el).removeClass(user.get('username'));
            },

            render: function() {
                $(this.el).html(this.template(this.model.toJSON())).addClass('desk-'+ this.model.collection.indexOf(this.model));
                return this;
            }
        });

        var Desks = Backbone.Collection.extend({
            model: Desk
        });

        var Message = Backbone.Model.extend({
        
        });

        var MessageView = Backbone.View.extend({
            initialize: function() {
            
            },

            template: _.template($('.message-template').html()),

            render: function() {
                // For now, if there is no username,
                // use the current user's username.
                // TODO: figure out a more elegant model
                // solution.
            
                if (!this.model.get('username')) {
                    this.model.set({'username': app.get('user').get('username')});
                }
            
                $(this.el).html(this.template(this.model.toJSON()));
                return this;
            }
        });

        var Messages = Backbone.Collection.extend({
            initialize: function() {
                _.bindAll(this, 'sendMessage');
                this.bind('add', this.sendMessage);     
            },

            sendMessage: function(message) {
                // Prevents the client from rebroadcasting a message
                // received from the server.
                if (message.get('username')) { return; }

                console.log('chat should be sent here');
                socket.emit('chat', message.toJSON());
            }
        });

        var ChatLog = Backbone.Model.extend({
            initialize: function() {
                this.messages = new Messages;
                this.messages.chatLog = this;
            }
        });

        var ChatLogView = Backbone.View.extend({
            initialize: function() {
                _.bindAll(this, 'insertMessage'); 
                this.model.messages.bind('add', this.insertMessage)
            },

            className: 'chat-log',

            template: _.template($('.chat-log-template').html()),
        
            events: {
                'click .tab': 'toggleChatDrawer'
            },
        
            toggleChatDrawer: function(e) {
                var $drawer = this.el;
                var newVal = $drawer.css('top') === '0px' ? -226 : 0;
                $drawer.css({'top':newVal});
                $drawer.find('.tab-inner').text(newVal === 0 ? 'hide' : 'chat log');
            },

            insertMessage: function(message) {
                console.log('messages collection', this.model.messages);
                var messageView = new MessageView({model: message});
                var username = message.get('username');
                //TODO: make the UserViews listen to the chatlog
                //and then handle this 
                if (username) {
                    var $chatBox = $('<div class="chat-box">'+message.get('content')+'</div>');
                    $('.'+username+' .user').append($chatBox);
                    setInterval(function() {
                        $chatBox.fadeOut(2000, function(){
                            $chatBox.remove();
                        });
                    }, 4000);
                }
 
                // Add message to the chatlog drawer
                $(this.el).find('.pane').append(messageView.render().el).scrollTop($(messageView.el).offset().top + 99999);
            
            },
        
            render: function() {
                $(this.el).html(this.template(this.model.toJSON()));
                return this;
            }
        });


        window.app = new App();
        window.appView = new AppView({model: app, el: $('body')});
        window.app.start({classSizeLimit: 20});

        // socket communication
        socket = io.connect('', {port: 3000});
        
        socket.on('connected', function(data) {
            app.users.add(data.users);
            socket.emit('join', {username: jsonVars.user.username});
        });
        
        socket.on('joined', function(user) {

            app.users.add(user)
            console.log(user.username+ ' joined!');
        });
        
        socket.on('news', function (data) {
            console.log(data);
        });

        socket.on('chat', function(data) {
            console.log('chat '+ JSON.stringify(data));
            app.chatLog.messages.add(data);
        });

        socket.on('disconnected', function(user) {
            console.log(user.username + ' was disconnected');
            app.users.remove(app.users.get(user._id));
        });
    }
})();
