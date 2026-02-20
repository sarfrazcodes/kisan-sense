import axios from "axios";

export async function fetchMandiData() {
  try {
    const apiKey = process.env.NEXT_PUBLIC_DATA_GOV_API_KEY;

    const resourceId = "9ef84268-d588-465a-a308-a864a43d0070"; 
    // This is a common AGMARKNET dataset ID. Replace if needed.

    const url = `https://api.data.gov.in/resource/${resourceId}?api-key=${apiKey}&format=json&limit=1000`;

    const response = await axios.get(url);

    return response.data.records;
  } catch (error) {
    console.error("Error fetching mandi data:", error);
    return [];
  }
}