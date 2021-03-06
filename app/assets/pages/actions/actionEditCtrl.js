/**
 * @author f.ulusoy
 * created on 26.01.2017
 */
(function() {


  angular.module('BlurAdmin.pages.actions').controller('ActionEditCtrl', ActionEditCtrl);

  function ActionEditCtrl($state, $stateParams, toastr, Store) {
    var vm = this;
    vm.action = { };
    vm.callbackAuthEnabled = false;

    if ($stateParams.actionId && $stateParams.actionId !== 'new') {
      Store.find('action', $stateParams.actionId).then(function(action) {
        vm.action = action;
        if (vm.action.callbackAction.auth) {
          vm.callbackAuthEnabled = true;
        }
      });
    } else {
      vm.isNewAction = true;
      vm.action = Store.createRecord('action', {
        name: '',
        description: '',
        type: '',
        callbackAction: {}
      });
    }

    vm.saveAction = function() {
      vm.action.save()
        .then(function(resp) {
          _.merge(vm.action, resp);
          toastr.success('Saving action was successful');
        })
        .catch(function(err) {
          toastr.error('Saving action is failed!', 'Error');
        });
    };

  }

}());
