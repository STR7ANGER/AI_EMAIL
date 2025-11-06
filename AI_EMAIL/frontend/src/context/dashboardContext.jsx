import React, { createContext, useState, useContext, useEffect } from "react";

// Create the context
const DashboardContext = createContext();

// Helper functions for date formatting
const formatDate = (dateString) => {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch (err) {
    return "Unknown date";
  }
};

const formatTime = (dateString) => {
  try {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  } catch (err) {
    return "";
  }
};

// Helper function to extract email from string like "Name <email@domain.com>"
const extractEmail = (text) => {
  if (!text) return null;
  
  const match = text.match(/<([^>]+)>/);
  if (match && match[1]) return match[1];
  
  // If no match with angle brackets, check if the text itself is an email
  if (text.includes('@')) return text;
  
  return null;
};

export const DashboardProvider = ({ children }) => {
  // State variables
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [showReply, setShowReply] = useState(false);
  const [showAIReply, setShowAIReply] = useState(false);
  const [showReplyOptions, setShowReplyOptions] = useState(false);
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);

  // Config
  const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

  // Fetch emails from backend
  const fetchEmails = async () => {
    try {
      setLoading(true);
      
      const response = await fetch(`${API_URL}/api/email/inbox`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          
        },
        credentials: "include",
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Authentication failed. Please log in again.");
        }
        throw new Error("Failed to fetch emails");
      }

      const data = await response.json();
      const mappedEmails = data.map((email) => ({
        id: email.messageId,
        threadId: email.threadId,
        from: email.from || "Unknown Sender",
        fromName: email.from?.split("<")[0]?.trim() || "Unknown Sender",
        fromEmail: extractEmail(email.from),
        to: email.to || "me",
        subject: email.subject || "(No Subject)",
        body: email.snippet || "",
        preview: email.snippet || "",
        date: formatDate(email.date || new Date()),
        time: formatTime(email.date || new Date()),
        read: false,
      }));

      setEmails(mappedEmails);
    } catch (err) {
      console.error("Error fetching emails:", err);
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Load emails on initial render
  useEffect(() => {
    fetchEmails();
  }, [API_URL]);

  // Email handlers
  const handleRefresh = () => {
    setRefreshing(true);
    fetchEmails();
  };

  const handleEmailClick = async (email) => {
    try {
      if (!email.read) {
        // Update local state first for better UX
        setEmails(emails.map((e) => (e.id === email.id ? { ...e, read: true } : e)));
        console.log(`Would mark email ${email.id} as read`);
      }
      setSelectedEmail(email);
    } catch (err) {
      console.error("Error marking email as read:", err);
    }
  };

  // UI control handlers
  const closeEmailDetail = () => {
    setSelectedEmail(null);
    setShowReply(false);
    setShowAIReply(false);
    setShowReplyOptions(false);
  };

  const openReplyOptions = () => {
    setShowReplyOptions(true);
  };

  const openReply = () => {
    setShowReplyOptions(false);
    setShowReply(true);
  };

  const openAIReply = () => {
    setShowReplyOptions(false);
    setShowAIReply(true);
  };

  const closeReply = () => {
    setShowReply(false);
    setShowAIReply(false);
    setShowReplyOptions(false);
  };

  // Handle sending the reply
  const handleSendReply = async (replyData) => {
    try {
      setSendingReply(true);
      
      // Always prioritize using the email extracted from the original sender
      let toEmail = selectedEmail.fromEmail;
      let toName = selectedEmail.fromName || "Recipient";
      
      // Only if we don't have the sender's email, try to use what the user provided
      if (!toEmail) {
        // Try to extract from the user-provided "to" field
        toEmail = extractEmail(replyData.to);
        
        // If still no email, use the whole "to" field as the name
        if (!toEmail) {
          toName = replyData.to.trim();
          // Don't create fake emails, throw an error instead
          throw new Error("Could not determine recipient's email address. Please include a valid email address.");
        }
      }
      
      // Format the address with name and email
      const toAddress = `${toName} <${toEmail}>`;
      
      console.log("Sending reply to:", toAddress);

      const completeReplyData = {
        to: toAddress,
        subject: replyData.subject,
        body: replyData.body,
        messageId: selectedEmail.id,
        threadId: selectedEmail.threadId || null,
      };

      console.log("Sending reply with data:", completeReplyData);

      const response = await fetch(`${API_URL}/api/gmail/reply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        
        },
        credentials: "include",
        body: JSON.stringify(completeReplyData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to send reply");
      }

      const result = await response.json();
      console.log("Reply sent successfully:", result);

      alert("Reply sent successfully!");

      // Clean up UI state
      setShowReply(false);
      setShowAIReply(false);
      handleRefresh();
    } catch (err) {
      console.error("Error sending reply:", err);
      alert(`Failed to send reply: ${err.message}`);
    } finally {
      setSendingReply(false);
    }
  };

  // Context value
  const value = {
    emails,
    selectedEmail,
    loading,
    error,
    refreshing,
    showReply,
    showAIReply,
    showReplyOptions,
    sendingReply,
    handleRefresh,
    handleEmailClick,
    closeEmailDetail,
    openReplyOptions,
    openReply,
    openAIReply,
    closeReply,
    handleSendReply,
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
};

// Custom hook to use the dashboard context
export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return context;
};
