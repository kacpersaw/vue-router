// install the v-view directive

module.exports = function (Vue) {

  // insert global css to make sure router-view has
  // display:block so that transitions work properly
  require('insert-css')('router-view{display:block;}')

  var _ = Vue.util
  var component = Vue.directive('_component')
  var templateParser = Vue.parsers.template

  // v-view extends v-component
  var viewDef = _.extend({}, component)

  // with some overrides
  _.extend(viewDef, {

    bind: function () {
      // react to route change
      this.currentRoute = null
      this.currentComponentId = null
      this.onRouteChange = _.bind(this.onRouteChange, this)
      this.unwatch = this.vm.$watch('route', this.onRouteChange)
      // force dynamic directive so v-component doesn't
      // attempt to build right now
      this._isDynamicLiteral = true
      // finally, init by delegating to v-component
      component.bind.call(this)
      if (this.vm.route) {
        this.onRouteChange(this.vm.route)
      }
    },

    onRouteChange: function (route) {
      var previousRoute = this.currentRoute
      this.currentRoute = route

      if (!route._matched) {
        // route not found, this outlet is invalidated
        return this.invalidate()
      }

      var segment = route._matched[route._matchedCount]
      if (!segment) {
        // no segment that matches this outlet
        return this.invalidate()
      }

      // for every route run global before function
      if(route._router._before) {
        var beforeResult = route._router._before(route, previousRoute)
        if (beforeResult === false) {
          if (route._router._hasPushState) {
            history.back()
          } else if (previousRoute) {
            route._router.go(previousRoute.path, {
              replace: true
            })
          }
          return
        }
      }

      // mutate the route as we pass it further down the
      // chain. this series of mutation is done exactly once
      // for every route as we match the components to render.
      route._matchedCount++
      // trigger component switch
      var handler = segment.handler
      if (handler.component !== this.currentComponentId ||
          handler.alwaysRefresh) {
        // call before hook
        if (handler.before) {
          var beforeResult = handler.before(route, previousRoute)
          if (beforeResult === false) {
            if (route._router._hasPushState) {
              history.back()
            } else if (previousRoute) {
              route._router.go(previousRoute.path, {
                replace: true
              })
            }
            return
          }
        }
        this.currentComponentId = handler.component
        // actually switch component
        this.realUpdate(handler.component, function () {
          // call after hook
          if (handler.after) {
            handler.after(route, previousRoute)
          }
        })
      } else if (this.childVM) {
        // update route context
        this.childVM.route = route
      }
    },

    invalidate: function () {
      this.currentComponentId = null
      this.realUpdate(null)
    },

    // currently duplicating some logic from v-component
    // TODO: make it cleaner
    build: function () {
      var route = this.currentRoute
      if (this.keepAlive) {
        var cached = this.cache[this.ctorId]
        if (cached) {
          cached.route = route
          return cached
        }
      }
      var vm = this.vm
      var el = templateParser.clone(this.el)
      if (this.Ctor) {
        var child = vm.$addChild({
          el: el,
          template: this.template,
          _asComponent: true,
          _host: this._host,
          data: {
            route: route
          }
        }, this.Ctor)
        if (this.keepAlive) {
          this.cache[this.ctorId] = child
        }
        return child
      }
    },

    unbind: function () {
      this.unwatch()
      component.unbind.call(this)
    }

  })

  Vue.elementDirective('router-view', viewDef)
}