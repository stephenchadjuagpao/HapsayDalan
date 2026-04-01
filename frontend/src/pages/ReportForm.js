import React, { useState } from "react";
import API from "../services/api";

function ReportForm() {
  const [formData, setFormData] = useState({
    violation_type: "",
    description: "",
    location: "",
    image: null
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleFileChange = (e) => {
    setFormData({
      ...formData,
      image: e.target.files[0]
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = new FormData();

    Object.keys(formData).forEach(key => {
      data.append(key, formData[key]);
    });

    await API.post("reports/", data);
    alert("Report Submitted Successfully!");
  };

  return (
    <form onSubmit={handleSubmit}>
      <input name="violation_type" placeholder="Violation Type" onChange={handleChange} />
      <textarea name="description" placeholder="Description" onChange={handleChange}></textarea>
      <input name="location" placeholder="Location" onChange={handleChange} />
      <input type="file" onChange={handleFileChange} />
      <button type="submit">Submit Report</button>
    </form>
  );
}

export default ReportForm;