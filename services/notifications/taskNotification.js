// services/notifications/taskNotification.js

const User = require("../../models/User");
const CoreNotification = require("./coreNotification");
const BaseNotification = require("./baseNotification");

/**
 * Task Notification Module
 */
class TaskNotification extends BaseNotification {
  /**
   * Notify when task is created
   */
  static async notifyTaskCreated(task, createdBy) {
    try {
      const notifications = [];
      const creator = await User.findById(createdBy);
      if (!creator) return [];

      // 1. Creator notification
      notifications.push({
        userId: createdBy,
        title: "Task Created",
        message: `Task "${task.title}" has been created`,
        type: "task",
        data: {
          taskId: task._id,
          action: "created",
          projectId: task.projectId,
        },
      });

      // 2. Assigned users
      if (task.assignedTo?.length) {
        const assignedUsers = await User.find({
          _id: { $in: task.assignedTo },
          isActive: true,
        });

        for (const user of assignedUsers) {
          if (user._id.toString() !== createdBy.toString()) {
            notifications.push({
              userId: user._id,
              title: "New Task Assigned",
              message: `You've been assigned: "${task.title}"`,
              type: "task",
              data: {
                taskId: task._id,
                action: "assigned",
                assignedBy: createdBy,
                dueDate: task.dueDate,
              },
            });
          }
        }
      }

      return await CoreNotification.createBulk(notifications);
    } catch (error) {
      console.error("❌ TaskNotification.notifyTaskCreated error:", error);
      throw error;
    }
  }

  /**
   * Notify when task is completed
   */
  static async notifyTaskCompleted(task, completedBy) {
    try {
      const notifications = [];
      const completer = await User.findById(completedBy);
      if (!completer) return [];

      // Notify creator
      if (
        task.createdBy &&
        task.createdBy.toString() !== completedBy.toString()
      ) {
        notifications.push({
          userId: task.createdBy,
          title: "Task Completed",
          message: `Task "${task.title}" completed by ${completer.name}`,
          type: "task",
          data: {
            taskId: task._id,
            action: "completed",
            completedBy,
            completerName: completer.name,
          },
        });
      }

      return await CoreNotification.createBulk(notifications);
    } catch (error) {
      console.error("❌ TaskNotification.notifyTaskCompleted error:", error);
      throw error;
    }
  }
}

module.exports = TaskNotification;
