(function() {
    Backbone.emulateHTTP = true;
    Backbone.emulateJSON = true;

    // underscore template languate settings
    _.templateSettings = {
      interpolate : /\{\{(.+?)\}\}/g, // {{ var }}
      evaluate: /\{\%(.+?)\%\}/g // {% expression %}
    };

    var socket = io.connect('http://localhost:3001');
    socket.on('news', function (data) {
        console.log(data);
        socket.emit('my other event', { my: 'data' });
    });

    $('.create-project').click(function(e) {
        e.preventDefault();
        var $form = $('.global.stash .project-form').clone(true).hide();
        $('body').append($form);
        $form.fadeIn();
    });

    $('.project-form .cancel').click(function(e) {
        e.preventDefault();
        $(e.target).closest('.project-form').fadeOut('fast', function() {
            $(this).remove();
        });
    });

    $('.project-form .submit').click(function() {
        $form = $(this).closest('.project-form');
        var title = $form.find('.project-title').val();
        var mediaId = $form.find('.project-media-url').val().match(/[0-9a-zA-Z_\-]{11}/);
        socket.emit('project:create', {title: title, media: mediaId, userId: jsonVars.user._id});
    });
})();
