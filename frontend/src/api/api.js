import client from "./client";

export const authApi = {
  signup: (payload) => client.post("/auth/signup", payload),
  login: (payload) => client.post("/auth/login", payload),
  me: () => client.get("/auth/me"),
  inviteTeacher: (payload) => client.post("/auth/teachers/invite", payload),
  listTeachers: () => client.get("/auth/teachers"),
};

export const batchesApi = {
  list: (params) => client.get("/batches", { params }),
  get: (id) => client.get(`/batches/${id}`),
  create: (payload) => client.post("/batches", payload),
  update: (id, payload) => client.put(`/batches/${id}`, payload),
  remove: (id) => client.delete(`/batches/${id}`),
};

export const studentsApi = {
  list: (params) => client.get("/students", { params }),
  get: (id) => client.get(`/students/${id}`),
  create: (payload) => client.post("/students", payload),
  update: (id, payload) => client.put(`/students/${id}`, payload),
  remove: (id) => client.delete(`/students/${id}`),
};

export const feesApi = {
  list: (params) => client.get("/fees", { params }),
  summary: () => client.get("/fees/summary"),
  create: (payload) => client.post("/fees", payload),
  markPaid: (id, payload) => client.post(`/fees/${id}/mark-paid`, payload),
};

export const attendanceApi = {
  list: (params) => client.get("/attendance", { params }),
  submit: (payload) => client.post("/attendance", payload),
};

export const testScoresApi = {
  list: (params) => client.get("/test-scores", { params }),
  create: (payload) => client.post("/test-scores", payload),
  report: (batchId) => client.get("/test-scores/report", { params: { batch_id: batchId } }),
};

export const templatesApi = {
  list: (params) => client.get("/templates", { params }),
  create: (payload) => client.post("/templates", payload),
  update: (id, payload) => client.put(`/templates/${id}`, payload),
  remove: (id) => client.delete(`/templates/${id}`),
};

export const messagingApi = {
  sendFeeReminders: (payload) => client.post("/messaging/fee-reminders", payload),
  sendParentUpdates: (payload) => client.post("/messaging/parent-updates", payload),
  logs: () => client.get("/messaging/logs"),
};

export const automationsApi = {
  list: () => client.get("/automations"),
  upsert: (payload) => client.put("/automations", payload),
};

export const setupApi = {
  status: () => client.get("/setup/status"),
  importStudents: (payload) => client.post("/setup/import-students", payload),
};
