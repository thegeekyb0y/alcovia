import Constants from "expo-constants";

export const CURRENT_STUDENT_ID = "stu_01";

const debuggerHost = Constants.expoConfig?.hostUri;
const devHost = debuggerHost?.split(":").shift() ?? "localhost";

export const API_BASE_URL = `http://${devHost}:3000/api`;
