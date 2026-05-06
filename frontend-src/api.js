const PREFIX = "/api";

const req = (url, options = {}) => {
  const { body } = options;

  return fetch((PREFIX + url).replace(/\/\/$/, ""), {
    ...options,
    body: body ? JSON.stringify(body) : null,
    headers: {
      ...options.headers,
      ...(body
        ? {
            "Content-Type": "application/json",
          }
        : null),
    },
  }).then((res) =>
    res.ok
      ? res.json()
      : res.text().then((message) => {
          throw new Error(message);
        })
  );
};

export const getNotes = ({ age, search, page } = {}) => {
  const query = new URLSearchParams();
  if (age) query.append('age', age);
  if (search) query.append('search', search);
  if (page) query.append('page', page);
  
  return req(`/notes?${query.toString()}`);
};

export const createNote = (title, text) => {
  return req('/notes', {
    method: 'POST',
    body: { title, text }
  });
};

export const getNote = (id) => {
  return req(`/notes/${id}`);
};

export const archiveNote = (id) => {
  return req(`/notes/${id}/archive`, {
    method: 'PUT'
  });
};

export const unarchiveNote = (id) => {
  return req(`/notes/${id}/unarchive`, {
    method: 'PUT'
  });
};

export const editNote = (id, title, text) => {
  return req(`/notes/${id}`, {
    method: 'PUT',
    body: { title, text }
  });
};

export const deleteNote = (id) => {
  return req(`/notes/${id}`, {
    method: 'DELETE'
  });
};

export const deleteAllArchived = () => {
  return req('/notes/archived', {
    method: 'DELETE'
  });
};

export const notePdfUrl = (id) => {
  return `${PREFIX}/notes/${id}/pdf`;
};
