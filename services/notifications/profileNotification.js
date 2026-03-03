// services/notifications/profileNotification.js

const User = require("../../models/User");
const CoreNotification = require("./coreNotification");
const BaseNotification = require("./baseNotification");

/**
 * Profile Notification Module
 * Handles all profile-related notifications:
 * - Profile creation (welcome, admin alerts)
 * - Profile updates
 * - Profile completion reminders
 * - Role changes
 * - Department transfers
 */
class ProfileNotification extends BaseNotification {
  /**
   * Notify when a new profile is created
   */
  static async notifyProfileCreated(newUser, createdBy = null) {
    try {
      const notifications = [];

      // Agar admin/manager ne profile banayi hai
      if (createdBy && createdBy !== newUser._id.toString()) {
        const creator = await User.findById(createdBy);
        if (!creator) return [];

        // 1. 🎉 Welcome to new user
        notifications.push({
          userId: newUser._id,
          title: "🎉 Welcome to the Team!",
          message: `Hello ${this.getUserFullName(newUser)}, your profile has been created. Get started by completing your profile!`,
          type: "profile",
          data: {
            profileId: newUser._id,
            action: "welcome",
            role: newUser.role,
            department: newUser.department,
            createdBy: createdBy,
            creatorName: creator.name,
          },
        });

        // 2. ✅ Creator ko confirmation
        if (creator.shouldReceiveNotification?.("profile")) {
          notifications.push({
            userId: createdBy,
            title: "✅ Profile Created Successfully",
            message: `New profile created for ${this.getUserFullName(newUser)} (${newUser.role || "No Role"})`,
            type: "profile",
            data: {
              profileId: newUser._id,
              action: "created",
              userEmail: newUser.email,
              userRole: newUser.role,
              userDepartment: newUser.department,
              userName: this.getUserFullName(newUser),
            },
          });
        }

        // 3. 👥 HR/Admin team ko notification
        const admins = await User.find({
          role: { $in: ["admin", "hr_manager", "super_admin"] },
          isActive: true,
          _id: { $ne: createdBy },
        });

        for (const admin of admins) {
          if (admin.shouldReceiveNotification?.("profile")) {
            notifications.push({
              userId: admin._id,
              title: "👤 New User Registration",
              message: `${this.getUserFullName(newUser)} joined as ${newUser.role || "member"} in ${newUser.department || "General"}`,
              type: "profile",
              data: {
                profileId: newUser._id,
                action: "new_user",
                createdBy: createdBy,
                creatorName: creator.name,
                userEmail: newUser.email,
                userRole: newUser.role,
              },
            });
          }
        }

        // 4. 📋 Department head ko notification
        if (newUser.department) {
          const deptHead = await User.findOne({
            department: newUser.department,
            role: { $in: ["manager", "head", "director"] },
            isActive: true,
          });

          if (deptHead && deptHead._id.toString() !== createdBy.toString()) {
            if (deptHead.shouldReceiveNotification?.("profile")) {
              notifications.push({
                userId: deptHead._id,
                title: "📋 New Team Member",
                message: `${this.getUserFullName(newUser)} has joined your ${newUser.department} department`,
                type: "profile",
                data: {
                  profileId: newUser._id,
                  action: "department_join",
                  userRole: newUser.role,
                  createdBy: createdBy,
                  creatorName: creator.name,
                  userEmail: newUser.email,
                },
              });
            }
          }
        }
      } else {
        // 🙋 Self-registration (user ne khud register kiya)

        // 1. 🎊 Welcome to new user
        notifications.push({
          userId: newUser._id,
          title: "🎊 Welcome Aboard!",
          message: `Hi ${this.getUserFullName(newUser)}, thank you for joining! Complete your profile to get started.`,
          type: "profile",
          data: {
            profileId: newUser._id,
            action: "self_registration",
            email: newUser.email,
          },
        });

        // 2. 👮 Admins ko notify about new self-registration
        const admins = await User.find({
          role: { $in: ["admin", "hr_manager", "super_admin"] },
          isActive: true,
        });

        for (const admin of admins) {
          if (admin.shouldReceiveNotification?.("profile")) {
            notifications.push({
              userId: admin._id,
              title: "🆕 New User Self-Registration",
              message: `${this.getUserFullName(newUser)} (${newUser.email}) just joined the platform`,
              type: "profile",
              data: {
                profileId: newUser._id,
                action: "new_registration",
                userEmail: newUser.email,
                userRole: newUser.role || "Not specified",
                userName: this.getUserFullName(newUser),
              },
            });
          }
        }
      }

      if (notifications.length === 0) return [];

      return await CoreNotification.createBulk(notifications);
    } catch (error) {
      console.error(
        "❌ ProfileNotification.notifyProfileCreated error:",
        error,
      );
      throw error;
    }
  }

  /**
   * Notify when profile is updated
   */
  static async notifyProfileUpdated(userId, updatedBy, changes = {}) {
    try {
      const user = await User.findById(userId);
      const updater = await User.findById(updatedBy);

      if (!user || !updater) return null;

      // Khud ke profile update pe notification mat bhejo (optional)
      if (userId.toString() === updatedBy.toString()) {
        return null;
      }

      const notifications = [];
      const changeSummary = this._summarizeChanges(changes);

      // 1. 📝 User ko notify karo ki unka profile update hua
      notifications.push({
        userId: userId,
        title: "📝 Profile Updated",
        message: `Your profile was updated by ${this.getUserFullName(updater)}`,
        type: "profile",
        data: {
          profileId: userId,
          action: "updated_by_admin",
          updatedBy: updatedBy,
          updaterName: this.getUserFullName(updater),
          changes: changes,
          changeSummary: changeSummary,
          updatedAt: new Date(),
        },
      });

      // 2. ✅ Admin ko confirmation
      if (updater.shouldReceiveNotification?.("profile")) {
        notifications.push({
          userId: updatedBy,
          title: "✅ Profile Update Success",
          message: `You have updated ${this.getUserFullName(user)}'s profile`,
          type: "profile",
          data: {
            profileId: userId,
            action: "update_success",
            userName: this.getUserFullName(user),
            changes: changes,
            changeSummary: changeSummary,
          },
        });
      }

      // 3. 👥 HR team ko notification (agar role/department change hua hai)
      if (changes.role || changes.department) {
        const hrTeam = await User.find({
          role: { $in: ["admin", "hr_manager"] },
          isActive: true,
          _id: { $nin: [userId, updatedBy] },
        });

        for (const hr of hrTeam) {
          if (hr.shouldReceiveNotification?.("profile")) {
            notifications.push({
              userId: hr._id,
              title: "🔄 Profile Role/Department Changed",
              message: `${this.getUserFullName(user)}'s ${changes.role ? "role" : "department"} was updated by ${this.getUserFullName(updater)}`,
              type: "profile",
              data: {
                profileId: userId,
                action: "role_change",
                userName: this.getUserFullName(user),
                updatedBy: updatedBy,
                updaterName: this.getUserFullName(updater),
                changes: changes,
              },
            });
          }
        }
      }

      return await CoreNotification.createBulk(notifications);
    } catch (error) {
      console.error(
        "❌ ProfileNotification.notifyProfileUpdated error:",
        error,
      );
      throw error;
    }
  }

  /**
   * Notify when profile is completed (user filled all required fields)
   */
  static async notifyProfileCompleted(userId, completionPercentage) {
    try {
      const user = await User.findById(userId);
      if (!user) return null;

      // Check notification preference
      if (!user.shouldReceiveNotification?.("profile")) return null;

      const notification = {
        userId: userId,
        title: "🎯 Profile Complete!",
        message: `Congratulations! Your profile is now ${completionPercentage}% complete.`,
        type: "profile",
        data: {
          profileId: userId,
          action: "profile_completed",
          completionPercentage: completionPercentage,
          userName: this.getUserFullName(user),
        },
      };

      return await CoreNotification.create(notification);
    } catch (error) {
      console.error(
        "❌ ProfileNotification.notifyProfileCompleted error:",
        error,
      );
      throw error;
    }
  }

  /**
   * Notify profile completion reminder
   */
  static async notifyProfileReminder(userId, missingFields = []) {
    try {
      const user = await User.findById(userId);
      if (!user) return null;

      // Check notification preference
      if (!user.shouldReceiveNotification?.("profile")) return null;

      const fieldList = missingFields
        .map((f) => f.replace(/([A-Z])/g, " $1").toLowerCase())
        .join(", ");

      const notification = {
        userId: userId,
        title: "⏰ Complete Your Profile",
        message: `Please complete your profile. Missing: ${fieldList || "some information"}`,
        type: "profile",
        data: {
          profileId: userId,
          action: "profile_reminder",
          missingFields: missingFields,
          fieldList: fieldList,
        },
      };

      return await CoreNotification.create(notification);
    } catch (error) {
      console.error(
        "❌ ProfileNotification.notifyProfileReminder error:",
        error,
      );
      throw error;
    }
  }

  /**
   * Notify when user role changes
   */
  static async notifyRoleChanged(userId, oldRole, newRole, changedBy) {
    try {
      const user = await User.findById(userId);
      const changer = await User.findById(changedBy);

      if (!user || !changer) return [];

      const notifications = [];

      // 1. 🔔 User ko notify
      if (user.shouldReceiveNotification?.("profile")) {
        notifications.push({
          userId: userId,
          title: "🔄 Role Updated",
          message: `Your role has been changed from ${oldRole} to ${newRole}`,
          type: "profile",
          data: {
            profileId: userId,
            action: "role_changed",
            oldRole: oldRole,
            newRole: newRole,
            changedBy: changedBy,
            changerName: this.getUserFullName(changer),
          },
        });
      }

      // 2. 👥 Relevant teams ko notify
      const relevantRoles = ["admin", "hr_manager", "super_admin"];
      const relevantUsers = await User.find({
        role: { $in: relevantRoles },
        isActive: true,
        _id: { $nin: [userId, changedBy] },
      });

      for (const relevantUser of relevantUsers) {
        if (relevantUser.shouldReceiveNotification?.("profile")) {
          notifications.push({
            userId: relevantUser._id,
            title: "👤 User Role Changed",
            message: `${this.getUserFullName(user)}'s role changed from ${oldRole} to ${newRole}`,
            type: "profile",
            data: {
              profileId: userId,
              action: "role_change_notify",
              userName: this.getUserFullName(user),
              oldRole: oldRole,
              newRole: newRole,
              changedBy: changedBy,
              changerName: this.getUserFullName(changer),
            },
          });
        }
      }

      return await CoreNotification.createBulk(notifications);
    } catch (error) {
      console.error("❌ ProfileNotification.notifyRoleChanged error:", error);
      throw error;
    }
  }

  /**
   * Notify when user department changes
   */
  static async notifyDepartmentChanged(userId, oldDept, newDept, changedBy) {
    try {
      const user = await User.findById(userId);
      const changer = await User.findById(changedBy);

      if (!user || !changer) return [];

      const notifications = [];

      // 1. 🔔 User ko notify
      if (user.shouldReceiveNotification?.("profile")) {
        notifications.push({
          userId: userId,
          title: "🏢 Department Changed",
          message: `Your department has been changed from ${oldDept || "None"} to ${newDept}`,
          type: "profile",
          data: {
            profileId: userId,
            action: "department_changed",
            oldDepartment: oldDept,
            newDepartment: newDept,
            changedBy: changedBy,
            changerName: this.getUserFullName(changer),
          },
        });
      }

      // 2. 👥 New department head ko notify
      if (newDept) {
        const newDeptHead = await User.findOne({
          department: newDept,
          role: { $in: ["manager", "head"] },
          isActive: true,
        });

        if (newDeptHead && newDeptHead._id.toString() !== userId.toString()) {
          if (newDeptHead.shouldReceiveNotification?.("profile")) {
            notifications.push({
              userId: newDeptHead._id,
              title: "👋 New Team Member",
              message: `${this.getUserFullName(user)} has joined your ${newDept} department`,
              type: "profile",
              data: {
                profileId: userId,
                action: "new_team_member",
                userName: this.getUserFullName(user),
                userRole: user.role,
                newDepartment: newDept,
                changedBy: changedBy,
              },
            });
          }
        }
      }

      // 3. 👥 Old department head ko notify
      if (oldDept && oldDept !== newDept) {
        const oldDeptHead = await User.findOne({
          department: oldDept,
          role: { $in: ["manager", "head"] },
          isActive: true,
        });

        if (oldDeptHead && oldDeptHead._id.toString() !== userId.toString()) {
          if (oldDeptHead.shouldReceiveNotification?.("profile")) {
            notifications.push({
              userId: oldDeptHead._id,
              title: "👋 Team Member Left",
              message: `${this.getUserFullName(user)} has left your ${oldDept} department`,
              type: "profile",
              data: {
                profileId: userId,
                action: "team_member_left",
                userName: this.getUserFullName(user),
                oldDepartment: oldDept,
                newDepartment: newDept,
                changedBy: changedBy,
              },
            });
          }
        }
      }

      return await CoreNotification.createBulk(notifications);
    } catch (error) {
      console.error(
        "❌ ProfileNotification.notifyDepartmentChanged error:",
        error,
      );
      throw error;
    }
  }

  /**
   * Notify when user account is deactivated/activated
   */
  static async notifyAccountStatusChanged(userId, isActive, changedBy) {
    try {
      const user = await User.findById(userId);
      const changer = await User.findById(changedBy);

      if (!user || !changer) return [];

      const notifications = [];
      const status = isActive ? "activated" : "deactivated";
      const emoji = isActive ? "✅" : "⚠️";

      // 1. 🔔 User ko notify (if deactivated)
      if (!isActive && user.shouldReceiveNotification?.("profile")) {
        notifications.push({
          userId: userId,
          title: `${emoji} Account ${status}`,
          message: `Your account has been ${status} by ${this.getUserFullName(changer)}`,
          type: "profile",
          data: {
            profileId: userId,
            action: "account_status_changed",
            isActive: isActive,
            status: status,
            changedBy: changedBy,
            changerName: this.getUserFullName(changer),
          },
        });
      }

      // 2. 👥 Admins ko notify
      const admins = await User.find({
        role: { $in: ["admin", "super_admin"] },
        isActive: true,
        _id: { $nin: [userId, changedBy] },
      });

      for (const admin of admins) {
        if (admin.shouldReceiveNotification?.("profile")) {
          notifications.push({
            userId: admin._id,
            title: `${emoji} Account ${status}`,
            message: `${this.getUserFullName(user)}'s account has been ${status} by ${this.getUserFullName(changer)}`,
            type: "profile",
            data: {
              profileId: userId,
              action: "account_status_notify",
              userName: this.getUserFullName(user),
              isActive: isActive,
              status: status,
              changedBy: changedBy,
              changerName: this.getUserFullName(changer),
            },
          });
        }
      }

      return await CoreNotification.createBulk(notifications);
    } catch (error) {
      console.error(
        "❌ ProfileNotification.notifyAccountStatusChanged error:",
        error,
      );
      throw error;
    }
  }

  /**
   * Helper: Summarize changes for notification
   */
  static _summarizeChanges(changes) {
    const changedFields = Object.keys(changes).filter(
      (key) => !["updatedAt", "lastModified"].includes(key),
    );

    if (changedFields.length === 0) return "No significant changes";

    if (changedFields.length === 1) {
      const field = changedFields[0].replace(/([A-Z])/g, " $1").toLowerCase();
      return `${field} updated`;
    }

    return `${changedFields.length} fields updated`;
  }
}

module.exports = ProfileNotification;
