// public/js/api.js
export function addTagAPI(imageName, tag) {
    return fetch(`/api/images/${encodeURIComponent(imageName)}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag })
    }).then(response => {
      if (!response.ok) throw new Error('Failed to add tag');
      return response.json();
    });
  }
  
  export function updateDescriptionAPI(imageName, description) {
    return fetch(`/api/images/${encodeURIComponent(imageName)}/description`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description })
    }).then(response => {
      if (!response.ok) throw new Error('Failed to update description');
      return response.json();
    });
  }
  
  export function removeTagAPI(imageName, tag) {
    return fetch(`/api/images/${encodeURIComponent(imageName)}/tags/${encodeURIComponent(tag)}`, {
      method: 'DELETE'
    }).then(response => {
      if (!response.ok) throw new Error('Failed to remove tag');
      return response.json();
    });
  }