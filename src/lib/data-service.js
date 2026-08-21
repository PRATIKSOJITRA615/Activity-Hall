import { collection, doc, getDocs, getDoc, setDoc, addDoc, updateDoc, deleteDoc, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

// Subscribe to all members (real-time)
export const subscribeToMembers = (callback) => {
  const q = query(collection(db, "members"));
  return onSnapshot(q, (snapshot) => {
    const members = [];
    snapshot.forEach((doc) => {
      members.push(doc.data());
    });
    // Sort by status then by currentSeatIndex
    members.sort((a, b) => {
      if (a.status !== b.status) return a.status === "active" ? -1 : 1;
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      return a.currentSeatIndex - b.currentSeatIndex;
    });
    callback(members);
  });
};

// Subscribe to all activities/events (real-time)
export const subscribeToEvents = (callback) => {
  const q = query(collection(db, "events"), orderBy("eventNumber", "asc"));
  return onSnapshot(q, (snapshot) => {
    const events = [];
    snapshot.forEach((doc) => {
      events.push(doc.data());
    });
    callback(events);
  });
};


export const subscribeToAssignments = (callback) => {
  const q = query(collection(db, "assignments"));
  return onSnapshot(q, (snapshot) => {
    const assignmentsMap = {};
    snapshot.forEach((doc) => {
      // doc.id is the eventId
      assignmentsMap[doc.id] = doc.data().list || [];
    });
    callback(assignmentsMap);
  });
};

export const addMemberToDb = async (memberData) => {
  const docRef = doc(db, "members", memberData.id);
  await setDoc(docRef, memberData);
};

export const updateMemberInDb = async (memberId, updates) => {
  const docRef = doc(db, "members", memberId);
  await updateDoc(docRef, updates);
};

export const saveEventAndAssignments = async (newEvent, assignmentsList, updatedMembers) => {
  //  1. Save Event
  const eventRef = doc(db, "events", newEvent.id);
  await setDoc(eventRef, newEvent);

  //  2. Save Assignments under 'assignments' collection with eventId as doc ID
  const assignmentsRef = doc(db, "assignments", newEvent.id);
  await setDoc(assignmentsRef, { list: assignmentsList });

  //  3. Update all affected members with their new seat index
  // We can do this with Promise.all to update them quickly
  const updates = updatedMembers.map((m) => {
    const mRef = doc(db, "members", m.id);
    return updateDoc(mRef, { currentSeatIndex: m.currentSeatIndex });
  });
  await Promise.all(updates);
};

export const deleteEventFromDb = async (eventId, memberUpdates = []) => {
  await deleteDoc(doc(db, "events", eventId));
  await deleteDoc(doc(db, "assignments", eventId));

  if (memberUpdates.length) {
    await Promise.all(
      memberUpdates.map((m) => updateDoc(doc(db, "members", m.id), { currentSeatIndex: m.currentSeatIndex }))
    );
  }
};

export const deleteMemberFromDb = async (memberId) => {
  await deleteDoc(doc(db, "members", memberId));
};
