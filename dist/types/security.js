import { ObjectId } from 'mongodb';
;
export var SecurityAction;
(function (SecurityAction) {
    SecurityAction["LOGIN"] = "login";
    SecurityAction["LOGOUT"] = "logout";
    SecurityAction["PASSWORD_CHANGE"] = "password_change";
    SecurityAction["PASSWORD_RESET"] = "password_reset";
    SecurityAction["EMAIL_CHANGE"] = "email_change";
    SecurityAction["DEVICE_ADDED"] = "device_added";
    SecurityAction["DEVICE_REMOVED"] = "device_removed";
    SecurityAction["TWO_FACTOR_ENABLE"] = "two_factor_enable";
    SecurityAction["TWO_FACTOR_DISABLE"] = "two_factor_disable";
    SecurityAction["TWO_FACTOR_VERIFY"] = "two_factor_verify";
    SecurityAction["RECOVERY_CODES_GENERATE"] = "recovery_codes_generate";
    SecurityAction["RECOVERY_CODE_USE"] = "recovery_code_use";
    SecurityAction["SESSION_REVOKE"] = "session_revoke";
    SecurityAction["DEVICE_REVOKE"] = "device_revoke";
    SecurityAction["DEVICE_AUTHORIZE"] = "device_authorize";
    SecurityAction["PRIVACY_SETTINGS_CHANGE"] = "privacy_settings_change";
})(SecurityAction || (SecurityAction = {}));
//# sourceMappingURL=security.js.map