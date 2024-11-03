import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Tab, Tabs, TabList, TabPanel } from "react-tabs";
import axios from "axios";
import "react-tabs/style/react-tabs.css";
import "./event_details.css";

function EventDetails() {
  const { eventId } = useParams(); // Get eventId from URL parameters
  const [event, setEvent] = useState(null); // Store event details
  const [loading, setLoading] = useState(true); // Track loading state
  const navigate = useNavigate();

  const handleBack = () => {
    navigate(-1); // Go back to the previous page
  };

  // Fetch event details when the component is mounted or eventId changes
  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const response = await axios.get(`https://skip-api-1gup.onrender.com/get_event/${eventId}`);
        console.log("API Response:", response.data);
        if (response.data) {
          setEvent(response.data); // Set the event details directly
          setLoading(false);
        } else {
          console.log("Event not found!");
          setLoading(false);
        }
      } catch (error) {
        console.error("Error fetching event details: ", error);
        setLoading(false);
      }
    };

    fetchEvent();
  }, [eventId]);

  // Render loading state
  if (loading) {
    return <p>Loading...</p>;
  }

  // Render message if the event is not found
  if (!event) {
    return <p>Event not found!</p>;
  }

  // Render the component
  return (
    <div className="details-page">
      <h1>{event.eventName}</h1>
      <Tabs>
        <TabList>
          <Tab>Event Details</Tab>
          <Tab>
            Sessions {event.sessions && event.sessions.length > 0 ? `(${event.sessions.length})` : '(0)'}
          </Tab>
          <Tab>
            Attendees {event.attendees && event.attendees.length > 0 ? `(${event.attendees.filter(attendee => typeof attendee === 'object').length})` : '(0)'}
          </Tab>
          <Tab>
            Posts {event.posts && event.posts.length > 0 ? `(${event.posts.length})` : '(0)'}
          </Tab>
        </TabList>

        {/* Event Details Tab */}
        <TabPanel>
          <div className="event-details">
            <img className="event-image-details" src={event.eventImage} alt={event.eventName} />
            <p><span className="spanMe2">Date:</span> {event.eventDate}</p>
            <p className="marginMe2"><span className="spanMe2">Event Location:</span> {event.eventLocation}</p>
            <p className="marginMe2"><span className="spanMe2">Price:</span> {event.eventPrice || "Free"}</p>
            <p className="marginMe2"><span className="spanMe2">Event Type:</span> {event.eventType}</p>
            <p className="marginMe2"><span className="spanMe2">Event Details:</span> <br /> {event.eventDescription}</p>
            <button onClick={handleBack}>Back to Events</button>
          </div>
        </TabPanel>

        {/* Sessions Tab */}
        <TabPanel>
          <div className="sessions">
            <h2>Sessions</h2>
            <ul>
              {event.sessions && event.sessions.map((sessionObj, index) => {
                const session = sessionObj.session_object || {}; // Default to empty object if undefined
                return (
                  <li key={index}>
                    <p><span className="spanMe">Session Name:</span> {session.sessionName}</p>
                    <p className="marginMe2"><span className="spanMe">Speaker:</span> {session.speaker}</p>
                    <p className="marginMe2"><span className="spanMe">Time:</span> {session.time}</p>
                    <p className="marginMe2"><span className="spanMe">Date:</span> {session.date}</p>
                  </li>
                );
              })}
              {event.sessions && event.sessions.length === 0 && <p>No sessions available.</p>}
            </ul>
          </div>
        </TabPanel>

        {/* Attendees Tab */}
        <TabPanel>
          <div className="attendees">
            <h2>Attendees</h2>
            <ul>
              {event.attendees && event.attendees.map((attendee) => {
                if (typeof attendee === 'object') {
                  return (
                    <li key={attendee.attendeeId}>
                      <p><span className="spanMe">Username:</span> {attendee.username}</p>
                      <p className="marginMe2"><span className="spanMe">Email:</span> {attendee.userEmail || "N/A"}</p>
                      <p className="marginMe2"><span className="spanMe">Contact:</span> {attendee.contact}</p>
                      {/* Check if ticketCreatedAt is defined and parse it correctly */}
                      <p className="marginMe2"><span className="spanMe">Ticket Created At:</span> {attendee.ticketCreatedAt ? new Date(attendee.ticketCreatedAt["$date"]["$numberLong"]).toLocaleString() : "N/A"}</p>
                    </li>
                  );
                }
                return null; // Skip string entries
              })}
              {event.attendees && event.attendees.length === 0 && <p>No attendees available.</p>}
            </ul>
          </div>
        </TabPanel>

        {/* Posts Tab */}
        <TabPanel>
          <div className="posts">
            <h2>Posts</h2>
            <p>Total Posts: {event.posts && event.posts.length > 0 ? event.posts.length : 0}</p>
            {/* Add more logic here if needed to display a summary of posts */}
          </div>
        </TabPanel>
      </Tabs>
    </div>
  );
}

export default EventDetails;
