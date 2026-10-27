import { api } from "./api";

const formHeaders = { 'Content-Type': 'multipart/form-data' };


export const reclamationApi = {
  // 5. GET /api/reclamations
  list: (params = {}) => api.get('reclamations', { params }),

  // 6. GET /api/reclamations/{id}
  show: (id) => api.get(`reclamations/${id}`),

  // 1. POST /api/reclamations (step 1 - intake, JSON)
  createStep1: (payload) => api.post('reclamations', payload),

  close: (reclamationId, payload) => api.post(`reclamations/${reclamationId}/close`, payload),  

  // 4. POST /api/reclamations (step 1 - intake with attachments, multipart)
  createStep1WithAttachments: (payload, files = []) => {
    const formData = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined && value !== null) formData.append(key, value);
    });
    files.forEach((file) => formData.append('attachments[]', file));
    return api.post('reclamations', formData, { headers: formHeaders });
  },

  // 2. POST /api/reclamations/{id}/step-2
  updateStep2: (id, payload) => api.post(`reclamations/${id}/step-2`, payload),

  // 3. POST /api/reclamations/{id}/step-3 (multipart, supports justification_file)
  updateStep3: (id, payload) => api.post(`reclamations/${id}/step-3`, payload, { headers: formHeaders }),

  // 7. DELETE /api/reclamations/{id}
  remove: (id) => api.delete(`reclamations/${id}`),

  // 8. POST /api/reclamations/{id}/attachments
  addAttachments: (id, files = []) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('attachments[]', file));
    return api.post(`reclamations/${id}/attachments`, formData, { headers: formHeaders });
  },

  // 9. DELETE /api/reclamations/{reclamationId}/attachments/{attachmentId}
  deleteAttachment: (reclamationId, attachmentId) => api.delete(`reclamations/${reclamationId}/attachments/${attachmentId}`),

  // 10. GET /api/reclamations/{id}/corrective-actions
  listCorrectiveActions: (id) => api.get(`reclamations/${id}/corrective-actions`),

  // 11. POST /api/reclamations/{id}/corrective-actions
  createCorrectiveAction: (id, payload) => api.post(`reclamations/${id}/corrective-actions`, payload),


  deleteCorrectiveAction: (actionId) => api.delete(`corrective-actions/${actionId}`),



  // 13. POST /api/reclamations/{reclamationId}/corrective-actions/{actionId}
  updateCorrectiveAction: (reclamationId, actionId, payload) => api.put(`corrective-actions/${actionId}`, payload),

  
  

};

export default reclamationApi;