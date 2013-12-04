/*globals $, _, Backbone */

/**
 * fastLiveFilter jQuery plugin 1.0.3
 *
 * Copyright (c) 2011, Anthony Bush
 * License: <http://www.opensource.org/licenses/bsd-license.php>
 * Project Website: http://anthonybush.com/projects/jquery_fast_live_filter/
 **/

jQuery.fn.fastLiveFilter = function(list, options) {
  // Options: input, list, timeout, callback
  options = options || {};
  list = jQuery(list);
  var input = this;
  var timeout = options.timeout || 0;
  var callback = options.callback || function() {};

  var keyTimeout;

  // NOTE: because we cache lis & len here, users would need to re-init the plugin
  // if they modify the list in the DOM later.  This doesn't give us that much speed
  // boost, so perhaps it's not worth putting it here.
  var lis = $('.app-list-item');
  var oldDisplay = lis.length > 0 ? lis[0].style.display : "block";

  // do a one-time callback on initialization to make sure everything's in sync
  callback(lis.length);

  input.change(function() {
    var filter = input.val().toLowerCase();
    var li, oli;
    var numShown = 0;

    var show = [];
    for (var i = 0; i < lis.length; i++) {
      oli = lis[i];
      li = $(oli).find('h3')[0];
      if ((li.textContent || li.innerText || "").toLowerCase().indexOf(filter) >= 0) {
        if (oli.style.display === "none") {
          oli.style.display = oldDisplay;
        }
        show.push(window.all.get(oli.classList[1]));
        numShown++;
      } else {
        if (oli.style.display !== "none") {
          oli.style.display = "none";
        }
      }
    }
    callback(numShown, show);
    return false;
  }).keydown(function() {
    // TODO: one point of improvement could be in here: currently the change event is
    // invoked even if a change does not occur (e.g. by pressing a modifier key or
    // something)
    clearTimeout(keyTimeout);
    keyTimeout = setTimeout(function() { input.change(); }, timeout);
  });
  return this; // maintain jQuery chainability
};

(function(){

  (function(exports, Backbone){

    exports.Backpack = exports.Backpack || {};
    exports.Backpack.Models = exports.Backpack.Models || {};

    var LightboxModel = Backbone.Model.extend({

      defaults: {
        'open': false,
        'lock': false,
        'backgroundColor': 'rgba(0,0,0,0.9)'
      },

      setContent: function(content){
        this.set('content', content);
      },

      open: function(){
        this.set('open', true);
      },

      close: function(){
        this.trigger('close');
        this.set('open', false);
      },

      dismiss: function(){
        if (!this.get('lock')) {
          this.close();
        }
      },

      lock: function(){
        this.set('lock', true);
      },

      unlock: function(){
        this.set('lock', false);
      },

      color: function(color){
        this.set('backgroundColor', color);
      }

    });

    exports.Backpack.Models.Lightbox = LightboxModel;

  })(window, Backbone);

  (function(exports, $, _, Backbone){
    var Lightbox;

    exports.Backpack = exports.Backpack || {};
    exports.Backpack.Models = exports.Backpack.Models || {};

    Lightbox = Backbone.View.extend({

      template:  _.template(
        "<div class='lightbox-inner'>" +
          "<div class='lb-content'></div>" +
        "</div>"),
      className: 'lightbox',
      events: {
        'click': 'dismiss',
        'click .lb-content': 'noop',
        'click [data-lightbox-close]': 'close'
      },

      bindings: function(){
        this.model.on('change:open', this.toggle, this);
        this.model.on('change:content', this.updateContent, this);
        this.model.on('change:backgroundColor', this.updateColor, this);
      },

      initialize: function(){
        this.model = new Backpack.Models.Lightbox();
        this.bindings();
        this.toggle();
        this.append();
        if (this.options.content) {
          this.content(this.options.content);
        }
      },

      render: function(){
        var template = this.template();
        this.$el.html(template);
        return this;
      },

      content: function(content){
        this.model.setContent(content);
        return this;
      },

      updateContent: function(){
        var content = this.model.get('content');
        var el = content.render().el;
        this.$content = this.$el.find('.lb-content');
        this.$content.html(el);
      },

      updateColor: function(){
        var color = this.model.get('backgroundColor');
        this.$el.css('background-color', color);
      },

      color: function(color){
        this.model.color(color);
      },

      append: function(){
        this.render();
        $('body').append(this.$el);
      },

      toggle: function(){
        var open = this.model.get('open');
        this.$el.toggle(open);
      },

      lock: function(){
        this.model.lock();
        return this;
      },

      unlock: function(){
        this.model.unlock();
        return this;
      },

      open: function(event){
        this.model.open();
        return this;
      },

      close: function(event){
        this.model.close();
        return this;
      },

      dismiss: function(event){
        this.model.dismiss();
        return this;
      },

      noop: function(event){
        event.stopPropagation();
      }

    });

    exports.Backpack.Lightbox = Lightbox;

  })(window, jQuery, _, Backbone);


  // Mustache style templats {{ }}
  _.templateSettings = {
    interpolate : /\{\{(.+?)\}\}/g
  };

  Backbone.emulateHTTP = true;

  var $terminal = $('#terminal'),
      $setter = $('#setter'),
      $systemText = $('#system-text'),
      $promptText = $('#prompt-text'),
      caret = $('#caret');

  $terminal.click(function(e){
    $setter.focus();
  });

  $setter.keydown(function(e){
    key(this.value);
  });

  $setter.keyup(function(e){
    key(this.value);
  });

  $setter.keypress(function(e){
    key(this.value);
  });

  function key(text) {
    write(text);
    move(text.length);
  }

  function write(text) {
    $systemText.html(text);
  }

  function move(length) {

  }

  $setter.focus();

  var Item = Backbone.Model.extend({
    url: 'v1/apps/start',

    defaults: function() {
      return {
        id: _.uniqueId('app_'),
        cmd: null,
        mem: 10.0,
        cpus: 0.1,
        instances: 1,
        uris: []
      };
    },

    sync: function(method, model, options) {
      options = options || {};

      if (method === 'delete') {
        options = _.extend(options, {
          url: 'v1/apps/stop',
          contentType: 'application/json',
          data: JSON.stringify(options.attrs || model.toJSON(options))
        });
      } else if (method === 'scale') {
        method = 'create';
        options = _.extend(options, {
          url: 'v1/apps/scale',
          contentType: 'application/json',
          data: JSON.stringify(options.attrs || model.toJSON(options))
        });
      }

      Backbone.sync.apply(this, [method, model, options]);
    },

    scale: function(num, options) {
      options = options || {};
      this.set('instances', num);
      this.sync('scale', this, options);
    }
  });


  var Items = Backbone.Collection.extend({
    url: 'v1/apps/',
    model: Item
  });

  var AppItemView = Backbone.View.extend({
    tagName: 'li',
    className: 'app-list-item',
    template: _.template(
      "<div class='app-item'>" +
        "<div class='info-wrapper'>" +
          "<h3 class='app-item-header'>{{ id }}</h3>" +
          "<dl class='dl-horizontal'>" +
            "<dt>CMD:</dt><dd>{{ cmd }}</dd>" +
            "<dt class='uri-wrapper'>URIs:<ul class='uris'>{{uris}}</ul></dt><dd>{{ uriCount }}</dd>" +
            "<dt>Memory (MB):</dt><dd>{{ mem }}</dd>" +
            "<dt>CPUs:</dt><dd>{{ cpus }}</dd>" +
            "<dt>Instances:</dt><dd>{{ instances }}</dd>" +
          "</dl>" +
        "</div>" +
        "<div class='action-bar'>" +
          "<a class='scale' href='#'>SCALE</a> | " +
          "<a class='suspend' href='#'>SUSPEND</a> | " +
          "<a class='destroy' href='#'>DESTROY</a>" +
        "</div>" +
      "</div>"
    ),

    events: {
      'click .suspend': 'suspend',
      'click .destroy': 'destroy',
      'click .scale': 'scale'
    },

    initialize: function() {
      this.listenTo(this.model, {
        'change:instances': this.render,
        destroy: this.remove
      });

      this.$el.addClass(this.model.get('id'));
    },

    suspend: function(e) {
      if (confirm("Suspend " + this.model.id + "?\n\nThe application will be scaled to 0 instances.")) {
        this.model.scale(0);
      }

      e.preventDefault();
    },

    destroy: function(e) {
      var ok = confirm("Destroy application " + this.model.id + "?\n\nThis is irreversible.");
      if (ok) {
        this.model.destroy();
      }

      e.preventDefault();
    },

    scale: function(e) {
      var instances = prompt('How many instances?', this.model.get('instances'));
      if (instances) {
        this.model.scale(instances);
      }

      e.preventDefault();
    },

    remove: function() {
      this.$el.remove();
    },

    render: function() {
      var data = this.data(),
          html = this.template(data);
      this.$el.html(html);
      return this;
    },

    data: function() {
      var attr = this.model.toJSON(),
          total = (attr.cpus * attr.instances),
          uriCount = attr.uris.length,
          uris = (attr.uris.join('<li>'));
      attr = _.extend(attr, {
        total: total,
        uris: uris,
        uriCount: uriCount
      });
      return attr;
    }
  });

  var HomeView = Backbone.View.extend({
    el: '.start-view-list',

    events: {
      'click .add-button': 'addNew',
    },

    initialize: function() {
      this.$addButton = this.$('.add-button');

      this.listenTo(this.collection, {
        add: this.add,
        reset: this.render
      });
    },

    render: function() {
      var docFrag = document.createDocumentFragment();
      this.collection.each(function(model) {
        docFrag.appendChild((new AppItemView({model: model})).render().el);
      });

      this.$addButton.before(docFrag.childNodes);
      return this;
    },

    add: function(model, collection, options) {
      var view = new AppItemView({model: model});
      this.$addButton.before(view.render().el);
    },

    addNew: function() {
      var model = new Item(),
          collection = this.collection;

      var FormView = Backbone.View.extend({
        className: 'window',
        template: _.template($('#add-app-template').html()),

        events: {
          'submit form': 'save'
        },

        render: function() {
          this.$el.html(this.template(model.toJSON()));
          return this;
        },

        save: function(e) {
          e.preventDefault();

          var $inputs = $('#add-app-form').find('input');
          var data = {};

          $inputs.each(function(index, el) {
            var $el = $(el),
                name = $el.attr('name'),
                val = $el.val();

            if (name === 'uris') {
              val = val.split(',');
              // strip whitespace
              val = _.map(val, function(s){return s.replace(/ /g,''); });
              // reject empty
              val = _.reject(val, function(s){return (s === '');});
            }

            data[name] = val;
          });

          collection.create(data);
          window.lightbox.close();
        }
      });

      formView = new FormView();
      window.lightbox.content(formView);
      window.lightbox.open();
      $('#id-field').focus();
    },

    dismiss: function() {
      var model = formView.model;
      if (model.isNew()) {
        model.destroy();
      } else {
        this.collection.add(model);
      }
    },
  });


  var Router = Backbone.Router.extend({
    routes: {
      '': 'index'
    },

    index: function() {
      window.lightbox = new Backpack.Lightbox();

      var apps = new Items();
      var start = new HomeView({
        collection: apps
      });

      $('.content').append(start.render().el);

      apps
        .fetch({reset: true})
        .done(function() {
          window.all = apps;
          var $input = $('#setter');
          var $caret = $('.system-caret');

          $input.fastLiveFilter('.start-view-list');

          $input.focusin(function(){
            $caret.addClass('focus');
          });

          $input.focusout(function(){
            $caret.removeClass('focus');
          });
        });
    }

  });

  window.router = new Router();
  Backbone.history.start({
    pushState: true
  });

})();
