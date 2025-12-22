(function () {
  window.nrlviewer = window.nrlviewer || {};

  window.nrlviewer.mediator = {
    customEvents: {
      listeners: {},
      emit: function (event, data) {
        if (!this.listeners[event]) return;
        this.listeners[event].forEach((callback) => callback(data));
      },
      on: function (event, callback) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);
      },
      off: function (event, callback) {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event].filter(
          (cb) => cb !== callback
        );
      },
    },
  };
})();
