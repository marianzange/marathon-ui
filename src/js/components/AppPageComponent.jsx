import React from "react/addons";
import classNames from "classnames";

import AppsEvents from "../events/AppsEvents";
import AppsStore from "../stores/AppsStore";
import BreadcrumbComponent from "../components/BreadcrumbComponent";
import AppHealthBarComponent from "./AppHealthBarComponent";
import AppPageControlsComponent from "./AppPageControlsComponent";
import AppStatusComponent from "../components/AppStatusComponent";
import AppVersionsActions from "../actions/AppVersionsActions";
import AppDebugInfoComponent from "../components/AppDebugInfoComponent";
import AppVersionListComponent from "../components/AppVersionListComponent";
import AppVolumesListComponent from "../components/AppVolumesListComponent";
import DialogActions from "../actions/DialogActions";
import DialogStore from "../stores/DialogStore";
import DialogSeverity from "../constants/DialogSeverity";
import HealthStatus from "../constants/HealthStatus";
import Messages from "../constants/Messages";
import States from "../constants/States";
import TabPaneComponent from "../components/TabPaneComponent";
import TaskDetailComponent from "../components/TaskDetailComponent";
import TaskViewComponent from "../components/TaskViewComponent";
import AppHealthDetailComponent from "./AppHealthDetailComponent";
import TogglableTabsComponent from "../components/TogglableTabsComponent";
import Util from "../helpers/Util";
import PathUtil from "../helpers/PathUtil";
import TasksActions from "../actions/TasksActions";
import TasksEvents from "../events/TasksEvents";

var tabsTemplate = [
  {id: "apps/:appId", text: "Instances"},
  {id: "apps/:appId/configuration", text: "Configuration"},
  {id: "apps/:appId/debug", text: "Debug"},
  {id: "apps/:appId/volumes", text: "Volumes"}
];

var AppPageComponent = React.createClass({
  displayName: "AppPageComponent",

  contextTypes: {
    router: React.PropTypes.oneOfType([
      React.PropTypes.func,
      // This is needed for the tests, the context differs there.
      React.PropTypes.object
    ])
  },

  getInitialState: function () {
    var settings = this.getRouteSettings(this.props);
    settings.fetchState = States.STATE_LOADING;
    return settings;
  },

  getRouteSettings: function () {
    var router = this.context.router;
    var params = router.getCurrentParams();

    var appId = decodeURIComponent(params.appId);
    var view = params.view;
    var volumeId = params.volumeId;

    var activeTabId = `apps/${encodeURIComponent(appId)}`;

    var activeViewIndex = 0;
    var activeTaskId = null;

    var app = AppsStore.getCurrentApp(appId);

    var tabs = tabsTemplate.map(function (tab) {
      var id = tab.id.replace(":appId", encodeURIComponent(appId));

      return {
        id: id,
        text: tab.text
      };
    });

    if (view === "configuration") {
      activeTabId += "/configuration";
    } else if (view === "debug") {
      activeTabId += "/debug";
    } else if (view === "volumes") {
      activeTabId += "/volumes";
    } else if (volumeId != null) {
      activeViewIndex = 2;
    } else if (view != null) {
      activeTaskId = view;
      activeViewIndex = 1;
    }

    return {
      activeTabId: activeTabId,
      activeTaskId: activeTaskId,
      activeViewIndex: activeViewIndex,
      app: app,
      volumeId: volumeId,
      appId: appId,
      view: decodeURIComponent(params.view),
      tabs: tabs
    };
  },

  componentWillMount: function () {
    AppsStore.on(AppsEvents.CHANGE, this.onAppChange);
    AppsStore.on(AppsEvents.REQUEST_APP_ERROR, this.onAppRequestError);
    AppsStore.on(AppsEvents.DELETE_APP, this.onDeleteAppSuccess);
    AppsStore.on(TasksEvents.DELETE_ERROR, this.onDeleteTaskError);
  },

  componentWillUnmount: function () {
    AppsStore.removeListener(AppsEvents.CHANGE,
      this.onAppChange);
    AppsStore.removeListener(AppsEvents.REQUEST_APP_ERROR,
      this.onAppRequestError);
    AppsStore.removeListener(AppsEvents.DELETE_APP,
      this.onDeleteAppSuccess);
    AppsStore.removeListener(TasksEvents.DELETE_ERROR,
      this.onDeleteTaskError);
  },

  componentWillReceiveProps: function () {
    var params = this.context.router.getCurrentParams();

    var fetchState = this.state.fetchState;
    if (decodeURIComponent(params.appId) !== this.state.appId) {
      fetchState = States.STATE_LOADING;
    }

    this.setState(Util.extendObject(
      this.state,
      {fetchState: fetchState},
      this.getRouteSettings()
    ));
  },

  onAppChange: function () {
    var state = this.state;
    var app = AppsStore.getCurrentApp(state.appId);

    this.setState({
      app: app,
      fetchState: States.STATE_SUCCESS,
      tabs: state.tabs
    });

    if (state.view === "configuration") {
      AppVersionsActions.requestAppVersions(state.appId);
    }
  },

  onAppRequestError: function (message, statusCode) {
    var fetchState = States.STATE_ERROR;

    switch (statusCode) {
      case 401:
        fetchState = States.STATE_UNAUTHORIZED;
        break;
      case 403:
        fetchState = States.STATE_FORBIDDEN;
        break;
    }

    this.setState({
      fetchState: fetchState
    });
  },

  onDeleteAppSuccess: function () {
    this.context.router.transitionTo("apps");
  },

  onDeleteTaskError: function (errorMessage, statusCode, taskIds) {
    var appId = this.state.appId;
    if (statusCode === 409) {
      const dialogId = DialogActions.confirm({
        actionButtonLabel: "Stop Current Deployment and Scale",
        message: `In order to the kill the tasks and scale the ${appId} to a new
          number of instances, the current deployment will have to be forcefully
          stopped, and a new one started. Please be cautious, as this could
          result in unwanted states.`,
        severity: DialogSeverity.DANGER,
        title: "Error Killing Task and Scaling Application"
      });

      DialogStore.handleUserResponse(dialogId, function () {
        TasksActions.deleteTasksAndScale(appId, taskIds, true);
      });
    } else if (statusCode === 401) {
      DialogActions.alert({
        message: `Error scaling ${appId}: ${Messages.UNAUTHORIZED}`,
        severity: DialogSeverity.DANGER,
        title:"Error Killing Task and Scaling Application"
      });
    } else if (statusCode === 403) {
      DialogActions.alert({
        message: `Error scaling ${appId}: ${Messages.FORBIDDEN}`,
        severity: DialogSeverity.DANGER,
        title:"Error Killing Task and Scaling Application"
      });
    } else {
      DialogActions.alert({
        message: `Error scaling: ${errorMessage.message || errorMessage}`,
        severity: DialogSeverity.DANGER,
        title:"Error Killing Task and Scaling Application"
      });
    }
  },

  handleTabClick: function (id) {
    this.setState({
      activeTabId: id
    });
  },

  getUnhealthyTaskMessage: function (healthCheckResults = []) {
    return healthCheckResults.map((healthCheck, index) => {
      if (healthCheck && !healthCheck.alive) {
        var failedCheck = this.state.app.healthChecks[index];

        var protocol = failedCheck != null && failedCheck.protocol
          ? `${failedCheck.protocol} `
          : "";
        var host = this.state.app.host || "";
        var path = failedCheck != null && failedCheck.path
          ? failedCheck.path
          : "";
        var lastFailureCause = healthCheck.lastFailureCause
          ? `returned with status: '${healthCheck.lastFailureCause}'`
          : "failed";

        return "Warning: Health check " +
          `'${protocol + host + path}' ${lastFailureCause}.`;
      }
    }).join(" ");
  },

  getTaskHealthMessage: function (taskId, unhealthyDetails = false) {
    var task = AppsStore.getTask(this.state.appId, taskId);

    if (task === undefined) {
      return null;
    }

    switch (task.healthStatus) {
      case HealthStatus.HEALTHY:
        return "Healthy";
      case HealthStatus.UNHEALTHY:
        return unhealthyDetails
          ? this.getUnhealthyTaskMessage(task.healthCheckResults)
          : "Unhealthy";
      default:
        return "Unknown";
    }
  },

  getControls: function () {
    var state = this.state;

    if (state.activeViewIndex !== 0) {
      return null;
    }

    return (<AppPageControlsComponent model={state.app} />);
  },

  getTaskDetailComponent: function () {
    var state = this.state;
    var model = state.app;

    var task = AppsStore.getTask(state.appId, state.activeTaskId);

    return (
      <TaskDetailComponent
        appId={state.appId}
        fetchState={state.fetchState}
        taskHealthMessage={this.getTaskHealthMessage(state.activeTaskId, true)}
        hasHealth={Object.keys(model.healthChecks).length > 0}
        task={task} />
    );
  },

  getVolumeDetails: function () {
    var {app, volumeId} = this.state;
    var tasks = app.tasks;

    var volume = tasks
      // Get the first volume from a task with the same id as provided
      // by the router. This should be unique.
      .reduce((memo, task) => {
        if (memo == null) {
          return task.localVolumes
            .filter(volume => volume.persistenceId === volumeId)
            .reduce((memo, volume) => {
              if (memo != null) {
                return memo;

              }
              volume.taskId = task.id;
              volume.status = task.status == null
                ? "Detached"
                : "Attached";
              return volume;
            }, null);
        }
        return memo;
      }, null);

    if (volume == null) {
      return null;
    }

    if (app.container != null && app.container.volumes != null) {
      app.container.volumes.forEach(function (volumeConfig) {
        if (volumeConfig.containerPath &&
            volumeConfig.containerPath === volume.containerPath) {
          Object.keys(volumeConfig).forEach(key =>
            volume[key] = volumeConfig[key]
          );
        }
      });
    }

    var taskURI = "#apps/" +
      encodeURIComponent(this.state.appId) +
      "/" + encodeURIComponent(volume.taskId);

    return (
      <dl className={"dl-horizontal"}>
        <dt>ID</dt>
        <dd>{volume.persistenceId}</dd>
        <dt>Container Path</dt>
        <dd>{volume.containerPath}</dd>
        <dt>Mode</dt>
        <dd>{volume.mode}</dd>
        <dt>Size</dt>
        <dd>{volume.persistent.size}</dd>
        <dt>Task Id</dt>
        <dd>
          <a href={taskURI}>{volume.taskId}</a>
        </dd>
      </dl>
    );
  },

  getAppDetails: function () {
    var state = this.state;
    var model = state.app;

    var volumes = model.tasks.reduce((memo, task) => {
      if (task.localVolumes != null) {
        return memo.concat(task.localVolumes.map(volume => {
          volume.taskId = task.id;
          volume.status = task.status == null
            ? "Detached"
            : "Attached";
          return volume;
        }));
      }
      return memo;
    }, [])
      .map(volume => {
        if (model.container == null || model.container.volumes == null) {
          return null;
        }
        model.container.volumes.forEach(function (volumeConfig) {
          if (volumeConfig.containerPath &&
              volumeConfig.containerPath === volume.containerPath) {
            Object.keys(volumeConfig).forEach(key =>
              volume[key] = volumeConfig[key]
            );
            volume.appId = model.id;
          }
        });
        return volume;
      })
      .filter(volume => volume != null);

    var tabs = state.tabs.filter(tab =>
      tab.text !== "Volumes" ||
      (model.container != null && model.container.volumes != null));

    return (
      <TogglableTabsComponent className="page-body page-body-no-top"
          activeTabId={state.activeTabId}
          onTabClick={this.handleTabClick}
          tabs={tabs} >
        <TabPaneComponent
            id={"apps/" + encodeURIComponent(state.appId)}>
          <TaskViewComponent
            appId={state.appId}
            fetchState={state.fetchState}
            getTaskHealthMessage={this.getTaskHealthMessage}
            hasHealth={Object.keys(model.healthChecks).length > 0}
            tasks={model.tasks} />
        </TabPaneComponent>
        <TabPaneComponent
            id={"apps/" + encodeURIComponent(state.appId) + "/configuration"}>
          <AppVersionListComponent appId={state.appId} />
        </TabPaneComponent>
        <TabPaneComponent
            id={"apps/" + encodeURIComponent(state.appId) + "/debug"}>
          <AppDebugInfoComponent appId={state.appId} />
        </TabPaneComponent>
        <TabPaneComponent
            id={"apps/" + encodeURIComponent(state.appId) + "/volumes"}>
          <AppVolumesListComponent volumes={volumes} />
        </TabPaneComponent>
      </TogglableTabsComponent>
    );
  },

  render: function () {
    var content;
    var state = this.state;
    var model = state.app;

    if (this.state.activeViewIndex === 0) {
      content = this.getAppDetails();
    } else if (this.state.activeViewIndex === 1) {
      content = this.getTaskDetailComponent();
    } else if (this.state.activeViewIndex === 2) {
      content = this.getVolumeDetails();
    }

    var groupId = PathUtil.getGroupFromAppId(state.appId);
    var name = PathUtil.getAppName(state.appId);

    return (
      <div>
        <BreadcrumbComponent groupId={groupId}
          appId={state.appId}
          taskId={state.activeTaskId}
          volumeId={state.volumeId} />
        <div className="container-fluid">
          <div className="page-header">
            <h1>{name}</h1>
            <AppStatusComponent model={model} showSummary={true} />
            <div className="app-health-detail">
              <AppHealthBarComponent model={model} />
              <AppHealthDetailComponent
                className="list-inline"
                fields={[
                  HealthStatus.HEALTHY,
                  HealthStatus.UNHEALTHY,
                  HealthStatus.UNKNOWN,
                  HealthStatus.STAGED,
                  HealthStatus.OVERCAPACITY,
                  HealthStatus.UNSCHEDULED
                ]}
                model={model} />
            </div>
            {this.getControls()}
          </div>
          {content}
        </div>
      </div>
    );
  }
});

export default AppPageComponent;
