export enum Role {
    ADMIN = 'admin',
    MANAGER = 'manager',
    EMPLOYEE = 'employee',
  }
  
  export enum Permission {
    // Users
    USER_CREATE = 'user:create',
    USER_READ = 'user:read',
    USER_UPDATE = 'user:update',
    USER_DELETE = 'user:delete',
  
    // Tasks
    TASK_CREATE = 'task:create',
    TASK_READ = 'task:read',
    TASK_UPDATE = 'task:update',
    TASK_DELETE = 'task:delete',
    TASK_ASSIGN = 'task:assign',
    TASK_VIEW_ALL = 'task:view_all',
    TASK_VIEW_DEPARTMENT = 'task:view_department',
  
    // Reports
    REPORT_READ = 'report:read',
  
    // Settings
    SETTINGS_MANAGE = 'settings:manage',
  }