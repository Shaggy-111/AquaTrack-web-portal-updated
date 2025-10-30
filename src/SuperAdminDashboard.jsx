import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

// --- Configuration ---
const API_BASE_URL = 'https://aquatrack-backend.fly.dev';
const BOTTLE_PRICE = 100; // Use BOTTLE_PRICE from this SuperAdmin file

// --- Helper Functions ---
const backendToUiStatus = (s) => {
  if (s === 'pending') return 'New';
  if (s === 'in_progress') return 'In Progress';
  if (s === 'delivered') return 'Delivered';
  return 'Resolved';
};

const mapComplaint = (c) => {
  const storeNames = c.created_by?.stores?.map(s => s.store_name).join(', ') || 'N/A';
  return {
    id: String(c.id),
    subject: c.subject,
    description: c.description,
    customerName: c.created_by?.full_name || '—',
    role: `Partner at ${storeNames}` || '—',
    date: new Date(c.created_at),
    status: backendToUiStatus(c.status),
    photoUrl: c.photo_url || null, // <-- REMOVED THE **
  };
};
const mapOrderData = (apiData) => {
  if (!apiData) return [];
  return apiData.map(item => ({
    id: String(item.id),
    bottles: parseInt(item.order_details, 10),
    status: item.status,
    orderDate: new Date(item.created_at),
    isPartnerOrder: !!item.partner_id,
    partner_id: item.partner_id,
    partnerName: item.partner ? item.partner.full_name : 'N/A',
    customerName: item.store ? item.store.store_name : 'Customer',
    deliveryPartnerId: item.delivery_person_id,
    deliveryPartnerName: item.delivery_person ? item.delivery_person.full_name : 'N/A',
  }));
};

const formatReportMonth = (dateString) => {
    if (!dateString) return 'N/A';
    
    const parts = dateString.split('-'); 
    if (parts.length < 2) return dateString;

    try {
        const year = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1; 
        const date = new Date(year, month, 1); 
        
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } catch (e) {
        return 'Invalid Date Format';
    }
};

// --- Reusable Components ---
const StatCard = ({ label, value, icon, bgColor, textColor, onPress }) => (
  <div style={{ ...styles.statCard, backgroundColor: bgColor, color: textColor }} onClick={onPress}>
    <div style={styles.statIcon}>{icon}</div>
    <div style={styles.statContent}>
      <p style={styles.statValue}>{value}</p>
      <p style={styles.statLabel}>{label}</p>
    </div>
  </div>
);

const SidebarItem = ({ label, icon, name, active, onSelect }) => (
  <button
    key={name}
    style={{ ...styles.sidebarItem, ...(active ? styles.sidebarItemActive : {}) }}
    onClick={() => onSelect(name)}
  >
    <span style={styles.sidebarIcon}>{icon}</span>
    <span style={{ ...styles.sidebarText, ...(active ? styles.sidebarTextActive : {}) }}>{label}</span>
  </button>
);

const Sidebar = ({ currentTab, onSelectTab }) => (
  <aside style={styles.sidebar}>
    <div style={styles.sidebarHeader}>
      <p style={styles.sidebarHeaderTitle}>AquaTrack</p>
      </div>
    <nav style={styles.sidebarNav}>
      <SidebarItem label="Dashboard" icon="📊" name="dashboard" active={currentTab === 'dashboard'} onSelect={onSelectTab} />
      <SidebarItem label="Orders" icon="📋" name="orders" active={currentTab === 'orders'} onSelect={onSelectTab} />
      <SidebarItem label="Create Partner" icon="🤝" name="createPartner" active={currentTab === 'createPartner'} onSelect={onSelectTab} />
      <SidebarItem label="My Partners" icon="👥" name="myPartners" active={currentTab === 'myPartners'} onSelect={onSelectTab} />
      <SidebarItem label="Delivery" icon="🚚" name="deliveryPartners" active={currentTab === 'deliveryPartners'} onSelect={onSelectTab} />
      <SidebarItem label="Complaints" icon="⚠️" name="complaints" active={currentTab === 'complaints'} onSelect={onSelectTab} />
      <SidebarItem label="Reports" icon="📝" name="reports" active={currentTab === 'reports'} onSelect={onSelectTab} />
      <SidebarItem label="QR" icon="📱" name="qrManagement" active={currentTab === 'qrManagement'} onSelect={onSelectTab} />
      <SidebarItem label="Active Stores" icon="🏬" name="activeStoresList" active={currentTab === 'activeStoresList'} onSelect={onSelectTab} />
    </nav>
  </aside>
);

// --- SolutionModal Component ---
const SolutionModal = ({ isVisible, onClose, onSubmit, complaintId, solutionText, setSolutionText, isLoading, modalStyles }) => {
    if (!isVisible) return null;
    return (
        <div style={modalStyles.backdrop}>
            <div style={modalStyles.modal}>
                <h3 style={modalStyles.title}>Resolve Complaint #{complaintId}</h3>
                <form onSubmit={onSubmit}>
                    <textarea
                        style={modalStyles.textarea}
                        placeholder="Enter your resolution message..."
                        value={solutionText}
                        onChange={(e) => setSolutionText(e.target.value)}
                        required
                        rows={5}
                        disabled={isLoading}
                    />
                    <div style={modalStyles.actions}>
                        <button type="button" onClick={onClose} style={modalStyles.cancelButton} disabled={isLoading}>
                            Cancel
                        </button>
                        <button type="submit" style={modalStyles.submitButton} disabled={isLoading || !solutionText.trim()}>
                            {isLoading ? 'Resolving...' : 'Submit Resolution'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- QR Assigning Modal Component ---
const AssignBottleModal = ({ isVisible, onClose, selectedBottlesToAssign, approvedDeliveryPartners, onAssign, modalStyles }) => {
    const [selectedPartnerId, setSelectedPartnerId] = useState('');

    if (!isVisible) return null;

    const handleAssign = (e) => {
        e.preventDefault();
        if (selectedPartnerId) {
            onAssign(selectedPartnerId);
        } else {
            alert('Please select a delivery partner.');
        }
    };

    return (
        <div style={modalStyles.backdrop}>
            <div style={{ ...modalStyles.modal, maxHeight: '80vh', overflowY: 'auto' }}>
                <h3 style={modalStyles.title}>Assign Bottles to Partner</h3>
                <p style={styles.modalSubtitle}>Assigning {selectedBottlesToAssign.length} bottle(s)</p>

                <form onSubmit={handleAssign} style={styles.form}>
                    <label style={styles.reportLabel}>Select Delivery Partner:</label>
                    <select
                        style={styles.textInput}
                        value={selectedPartnerId}
                        onChange={(e) => setSelectedPartnerId(e.target.value)}
                        required
                    >
                        <option value="">-- Select Partner --</option>
                        {approvedDeliveryPartners.map(dp => (
                            <option key={dp.id} value={dp.id}>
                                {dp.full_name} ({dp.email})
                            </option>
                        ))}
                    </select>

                    <div style={modalStyles.actions}>
                        <button type="button" onClick={onClose} style={modalStyles.cancelButton}>
                            Cancel
                        </button>
                        <button type="submit" style={modalStyles.submitButton} disabled={!selectedPartnerId}>
                            Assign
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- Main Component ---
const SuperAdminDashboard = () => {
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // --- Dashboard Data States ---
  const [totalOrders, setTotalOrders] = useState(0);
  const [customerOrdersCount, setCustomerOrdersCount] = useState(0);
  const [partnerOrdersCount, setPartnerOrdersCount] = useState(0);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [totalActiveStores, setTotalActiveStores] = useState(0);
  const [totalVendors, setTotalVendors] = useState(0);
  const [totalDeliveryPartners, setTotalDeliveryPartners] = useState(0);
  const [dailyOrders, setDailyOrders] = useState(0);
  const [newComplaints, setNewComplaints] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [monthlyRevenue, setMonthlyRevenue] = useState(0);
  const [monthlyOrdersCount, setMonthlyOrdersCount] = useState(0);
  const [pendingDeliveryPartnersCount, setPendingDeliveryPartnersCount] = useState(0); 
  // 🌟 NEW KPIs 🌟
  const [dailyDeliveredOrders, setDailyDeliveredOrders] = useState(0);
  const [monthlyDeliveredOrders, setMonthlyDeliveredOrders] = useState(0);
  
  // --- BOTTLE KPIs STATES (Needed for Dashboard) ---
  const [freshBottlesWarehouse, setFreshBottlesWarehouse] = useState(0); 
  const [emptyBottlesStores, setEmptyBottlesStores] = useState(0); 
  
// --- QR Management States ---
  const [generatedQrData, setGeneratedQrData] = useState(null);
  const [qrAssigning, setQrAssigning] = useState(false); 
  const [selectedBottlesToAssign, setSelectedBottlesToAssign] = useState([]);
  const [unassignedBottles, setUnassignedBottles] = useState([]); 

  // --- Core Data States ---
  const [partners, setPartners] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  const [allDeliveryPartners, setAllDeliveryPartners] = useState([]);
  const [approvedDeliveryPartners, setApprovedDeliveryPartners] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [isSolutionModalVisible, setIsSolutionModalVisible] = useState(false);
  const [currentComplaintId, setCurrentComplaintId] = useState(null);
  const [solutionText, setSolutionText] = useState('');
  const [resolvingComplaint, setResolvingComplaint] = useState(false); 
  // ... near other useState hooks
  const [isPartnerDetailsModalVisible, setIsPartnerDetailsModalVisible] = useState(false);
  const [selectedPartnerForDetails, setSelectedPartnerForDetails] = useState(null);
  // --- Report Management States ---
  const [reports, setReports] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null); 
  const [uploadingReport, setUploadingReport] = useState(false); 
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7)); 
  
  // --- New Partner Creation Form States ---
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [stores, setStores] = useState([]); 
  const [selectedStoreIds, setSelectedStoreIds] = useState([]);

  const [accessToken, setAccessToken] = useState(null);
    
 // 🌟 NEW STATES FOR DATE FILTERING IN ORDERS TAB 🌟
  const [ordersStartDate, setOrdersStartDate] = useState('');
  const [ordersEndDate, setOrdersEndDate] = useState('');
  const [filteredOrders, setFilteredOrders] = useState([]);
    
    // Update filtered orders whenever allOrders, ordersStartDate, or ordersEndDate changes
    useEffect(() => {
        let filtered = allOrders;

        if (ordersStartDate && ordersEndDate) {
            const start = new Date(ordersStartDate);
            // Set time to end of day for proper range filtering
            const end = new Date(ordersEndDate);
            end.setHours(23, 59, 59, 999); 
            

            filtered = allOrders.filter(order => {
                const orderDate = new Date(order.orderDate);
                // Compare date objects
                return orderDate >= start && orderDate <= end;
            });
        }
        setFilteredOrders(filtered);
    }, [ordersStartDate, ordersEndDate, allOrders]);
    
    const handleClearDates = () => {
        setOrdersStartDate('');
        setOrdersEndDate('');
    };


    // 🟢 NEW DATA AGGREGATION FOR CHART 🟢
    const getMonthlyOrderData = useMemo(() => {
        const monthlyData = {};
        
        // Use allOrders data available in component state
        allOrders.forEach(order => {
            // Only count delivered orders for sales/revenue charts
            if (order.status?.toLowerCase() !== 'delivered') return;

            const monthKey = order.orderDate.toISOString().slice(0, 7); // YYYY-MM
            const revenue = order.bottles * BOTTLE_PRICE;
            
            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = {
                    month: order.orderDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
                    totalRevenue: 0,
                    totalBottles: 0,
                };
            }
            monthlyData[monthKey].totalRevenue += revenue;
            monthlyData[monthKey].totalBottles += order.bottles;
        });

        // Convert object into a sorted array and limit to last 6 months
        return Object.keys(monthlyData)
            .sort()
            .slice(-6) 
            .map(key => monthlyData[key]);
    }, [allOrders]);
    
    // 🟢 CHART COMPONENT PLACEHOLDER 🟢
    const MonthlyPerformanceChart = ({ data }) => {
        if (data.length === 0) {
            return (
                <div style={styles.chartPlaceholder}>
                    <p>No delivered orders data available for charting.</p>
                </div>
            );
        }
        
        // This simulates the chart area with the calculated data points
        return (
            <div style={{ height: '350px', width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                <div style={styles.chartPlaceholder}>
                    <h4 style={{ color: '#1A2A44', margin: '5px 0' }}>Monthly Revenue Trend (Last {data.length} Months)</h4>
                    <p style={{marginBottom: 10, color: '#00796B', fontWeight: 'bold'}}>TOTAL REVENUE VS. VOLUME</p>
                    {data.map((d, index) => (
                        <p key={index} style={{ margin: '3px 0', fontSize: '14px', color: '#333' }}>
                            **{d.month}**: **₹{d.totalRevenue.toLocaleString('en-IN')}** ({d.totalBottles} bottles)
                        </p>
                    ))}
                    <p style={{ marginTop: 20, fontSize: 12, color: '#888' }}>
                         (Placeholder for Sales Chart)
                    </p>
                </div>
            </div>
        );
    };

    // --- API Fetching Functions (Resilient Logic) ---
    const fetchAllData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('userToken');
      if (!token) {
        alert('Authentication Required. Please log in to access the dashboard.');
        navigate('/login/superadmin');
        return;
      }
      setAccessToken(token);

      const authHeaders = { headers: { 'Authorization': `Bearer ${token}` } };
      
      // 1. Define all API promises
      const promises = [
        axios.get(`${API_BASE_URL}/superadmin/orders/all`, authHeaders),         // [0] All Orders
        axios.get(`${API_BASE_URL}/superadmin/orders/pending`, authHeaders),      // [1] Pending Orders
        axios.get(`${API_BASE_URL}/store/store/list`, authHeaders),             // [2] Stores List
        axios.get(`${API_BASE_URL}/partners/partners/list`, authHeaders),         // [3] Partners List
        axios.get(`${API_BASE_URL}/partners/partners/superadmin/delivery-partners`, authHeaders), // [4] Delivery Partners
        axios.get(`${API_BASE_URL}/bottle/superadmin/unassigned-bottles`, authHeaders), // [5] Unassigned Bottles
        axios.get(`${API_BASE_URL}/complaints/complaints/assigned`, authHeaders), // [6] Complaints
        axios.get(`${API_BASE_URL}/bottle/partner/me/empty-bottles`, authHeaders), // [7] Empty Bottles
        axios.get(`${API_BASE_URL}/reports/reports/list`, authHeaders),           // [8] Reports List
      ];
      
      // 2. Wait for all promises to settle (resolve or reject)
      const results = await Promise.allSettled(promises);
      
      // Helper to safely get data or null
      const getData = (index) => {
        const result = results[index];
        if (result.status === 'fulfilled') {
            return result.value.data;
        } else {
            console.warn(`API at index ${index} failed:`, result.reason?.response?.data || result.reason?.message);
            // Check for critical auth error in a rejected promise
            if (result.reason?.response?.status === 401) {
                throw new Error('Authentication Error during data fetch.');
            }
            return null;
        }
      };
      
      // 3. Process Fulfilled Promises Safely
      const allOrdersData = getData(0);

        if (allOrdersData) {
            const mappedOrders = mapOrderData(allOrdersData);
            setAllOrders(mappedOrders); 
            setFilteredOrders(mappedOrders); 
            setTotalOrders(mappedOrders.length);

            const today = new Date();
            const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
            
            const deliveredOrders = mappedOrders.filter(order => order.status?.toLowerCase() === 'delivered');

            // Calculate Today's & Monthly ORDERS (All statuses)
            const todayOrders = mappedOrders.filter(order => order.orderDate.getTime() >= startOfToday);
            setDailyOrders(todayOrders.length);

            const currentMonth = today.getMonth();
            const currentYear = today.getFullYear();
            const monthlyOrders = mappedOrders.filter(order => {
                const orderDate = new Date(order.orderDate);
                return orderDate.getMonth() === currentMonth && orderDate.getFullYear() === currentYear;
            });
            setMonthlyOrdersCount(monthlyOrders.length);

            // 🌟 Calculate Today's & Monthly DELIVERED ORDERS (New KPI) 🌟
            const todayDeliveredOrders = deliveredOrders.filter(order => order.orderDate.getTime() >= startOfToday);
            setDailyDeliveredOrders(todayDeliveredOrders.length);

            const monthlyDeliveredOrders = deliveredOrders.filter(order => {
                const orderDate = new Date(order.orderDate);
                return orderDate.getMonth() === currentMonth && orderDate.getFullYear() === currentYear;
            });
            setMonthlyDeliveredOrders(monthlyDeliveredOrders.length);
            // -----------------------------------------------------------

            const totalRevenue = deliveredOrders.reduce((sum, order) => sum + (order.bottles * BOTTLE_PRICE), 0);
            const monthlyRevenue = monthlyDeliveredOrders.reduce((sum, order) => sum + (order.bottles * BOTTLE_PRICE), 0);
            setTotalRevenue(totalRevenue);
            setMonthlyRevenue(monthlyRevenue);
            setPartnerOrdersCount(mappedOrders.filter(order => order.isPartnerOrder).length);
            setCustomerOrdersCount(mappedOrders.filter(order => !order.isPartnerOrder).length);
        }

        const pendingOrdersData = getData(1);
        if (pendingOrdersData) {
            setPendingOrdersCount(mapOrderData(pendingOrdersData).length);
        }

        const storesData = getData(2) || [];
        setStores(storesData);
        setTotalActiveStores(storesData.length);

        const partnersData = getData(3) || [];
        setPartners(partnersData);
        setTotalVendors(partnersData.length);

        const allDeliveryPartnersData = getData(4) || [];
        setAllDeliveryPartners(allDeliveryPartnersData);
        setPendingDeliveryPartnersCount(allDeliveryPartnersData.filter(dp => dp.status === 'pending').length);
        setTotalDeliveryPartners(allDeliveryPartnersData.length);
        setApprovedDeliveryPartners(allDeliveryPartnersData.filter(dp => dp.status === 'active' || dp.status === 'approved'));

        const unassignedBottlesData = getData(5) || [];
        const mappedBottles = unassignedBottlesData.map((bottle) => ({
            UUID: bottle.uuid,
            qr_code: bottle.qr_code,
        }));
        setUnassignedBottles(mappedBottles);
        setFreshBottlesWarehouse(mappedBottles.length);

        const complaintItems = getData(6) || [];
        setComplaints(complaintItems.map(mapComplaint));
        setNewComplaints(complaintItems.filter((c) => c.status === 'pending').length);

        const emptyBottlesData = getData(7);
        setEmptyBottlesStores(emptyBottlesData?.empty_bottles_count || 0);


      // 🚨 Process Reports 🚨
      const reportsData = getData(8) || [];
      setReports(reportsData.map(r => {
          const rawDateString = r.report_date || r.month_year || r.uploaded_at;
          
          return {
              id: r.id,
              filename: r.filename || r.report_file_name || `Report-${rawDateString}.pdf`,
              rawMonthYear: rawDateString,
              uploadDate: new Date(r.created_at).toLocaleDateString(),
              url: `${API_BASE_URL}/reports/reports/download/${r.id}`,
          }
      }));
    } catch (error) {
      console.error('Critical Error:', error?.message);
      if (error.message.includes('Authentication Error')) {
        alert('Authentication Error. Please log in again.');
        localStorage.removeItem('userToken');
        navigate('/login/superadmin');
      } else {
        alert('Failed to load critical data. Check console for details.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [navigate]);
  
  // ------------------------------------------
  // --- EXCEL EXPORT HANDLER (FIX for SS1) ---
  // ------------------------------------------

const handleExportOrdersToExcel = () => {
  if (filteredOrders.length === 0) {
    alert("No orders available to export.");
    return;
  }

  const headers = [
    "Order ID",
    "Customer/Store Name",
    "Is Partner Order",
    "Bottles Ordered",
    "Total Revenue (INR)",
    "Status",
    "Order Date",
    "Delivery Partner",
  ];

  const csvData = filteredOrders.map(order => {
    const isDelivered = order.status?.toLowerCase() === 'delivered';
    const revenue = isDelivered ? order.bottles * BOTTLE_PRICE : 0;
    
    // Escape commas in string fields if necessary (though unlikely for these fields)
    const escape = (value) => `"${String(value).replace(/"/g, '""')}"`;

    return [
      escape(order.id),
      escape(order.customerName),
      escape(order.isPartnerOrder ? 'Yes' : 'No'),
      order.bottles,
      revenue,
      escape(order.status),
      order.orderDate.toLocaleDateString(),
      escape(order.deliveryPartnerName),
    ].join(',');
  });

  // Combine headers and data
  const csvContent = [headers.join(','), ...csvData].join('\n');

  // Create a Blob and download it
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  const today = new Date().toISOString().slice(0, 10);
  const filename = `Aquatrack_Orders_${ordersStartDate || 'All'}_to_${ordersEndDate || 'All'}_${today}.csv`;
  
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
};


  // ------------------------------------------
  // --- REPORT MANAGEMENT HANDLERS ---
  // ------------------------------------------

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
    } else {
      alert('Please select a PDF file.');
      setSelectedFile(null);
    }
  };

  const handleUploadReport = async (e) => {
    e.preventDefault();
    
    if (!selectedFile || !reportMonth) {
        alert('Please select a PDF file and choose the month.');
        return;
    }
    if (!accessToken) {
        alert('Authentication token is missing. Please log in again.');
        return;
    }

    setUploadingReport(true);
    const formData = new FormData();
    
    const isoDateString = `${reportMonth}-01`; 
    formData.append('report_file', selectedFile); 
    formData.append('report_date', isoDateString); 

    try {
        const response = await axios.post(
            `${API_BASE_URL}/reports/reports/upload`,
            formData,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            }
        );

        if (response.status >= 200 && response.status < 300) {
            alert('Monthly report uploaded successfully! (Status: ' + response.status + ')');
            setSelectedFile(null);
            e.target.reset(); 
            await fetchAllData(); 
        } else {
            throw new Error(`Server responded with status ${response.status}`);
        }
    } catch (error) {
        console.error('Report upload failed. Full error:', error.response?.data || error.message);
        
        let specificError = 'An unexpected error occurred.';

        if (error.response) {
            if (error.response.data && error.response.data.message) {
                 specificError = error.response.data.message;
            } else {
                 specificError = `Server returned status ${error.response.status}.`;
            }
        } else {
            specificError = 'Network error (No response).';
        }
        
        alert(`Report upload failed: ${specificError} Check console for details.`);
    } finally {
        setUploadingReport(false);
    }
};

const handleReportDownload = async (reportId) => {
    if (!accessToken) {
        alert("Authentication required to download file.");
        return;
    }

    try {
        const downloadUrl = `${API_BASE_URL}/reports/reports/download/${reportId}`;
        
        const response = await axios.get(
            downloadUrl,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`, 
                },
                responseType: 'blob', 
            }
        );

        if (response.status === 200) {
            const blob = new Blob([response.data], { type: response.headers['content-type'] });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            
            const filename = `Report_${reportId}_${new Date().toISOString().slice(0, 10)}.pdf`;

            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            
        } else {
            alert(`Download failed: Server returned status ${response.status}.`);
        }
    } catch (error) {
        console.error('Download failed:', error.response?.data || error.message);
        alert('File download failed. The specific download API endpoint may be incorrect or unauthorized.');
    }
};

  // ------------------------------------------
  // --- COMPLAINT RESOLUTION HANDLERS ---
  // ------------------------------------------

  const handleResolveClick = (complaintId) => {
    setCurrentComplaintId(complaintId);
    setSolutionText(''); 
    setIsSolutionModalVisible(true);
  };

  const handleCloseModal = () => {
    setIsSolutionModalVisible(false);
    setCurrentComplaintId(null);
    setSolutionText('');
  };

  const handleSolutionSubmit = async (e) => {
    e.preventDefault();
    const trimmedSolutionText = solutionText.trim();
    
    if (!trimmedSolutionText) {
        alert("Please enter a resolution message.");
        return;
    }
    if (!currentComplaintId || !accessToken) {
        if (!accessToken) {
            alert('Authentication token is missing. Please log in again.');
            localStorage.removeItem('userToken');
            navigate('/login/superadmin');
        }
        return;
    }

    setResolvingComplaint(true);

    try {
        const payload = { 
            status: 'resolved', 
            solution: trimmedSolutionText
        };
        
        const response = await axios.patch( 
            `${API_BASE_URL}/complaints/complaints/${currentComplaintId}/resolve`,
            payload, 
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        if (response.status === 200) {
            alert(`Complaint #${currentComplaintId} successfully resolved.`);
            handleCloseModal();
            await fetchAllData(); 
        } else {
            throw new Error(response.data?.message || `Server responded with status ${response.status}`);
        }
    } catch (error) {
        console.error('Complaint resolution failed:', error.response?.data || error.message);
        let specificError = 'Check console for network/server details.';

        if (error.response) {
            if (error.response.data && error.response.data.detail) {
                specificError = JSON.stringify(error.response.data.detail);
            } else if (error.response.status === 401 || error.response.status === 403) {
                specificError = 'Authorization failed. Please log in again.';
                localStorage.removeItem('userToken');
                navigate('/login/superadmin');
                return;
            } else {
                specificError = `Server returned status ${error.response.status}.`;
            }
        } else if (error.request) {
            specificError = 'Network error: Server did not respond.';
        }

        alert(`Failed to resolve complaint: ${specificError}`);
    } finally {
        setResolvingComplaint(false);
    }
  };


  // --- Partner Creation Function ---
  const handleCreatePartner = async (e) => {
    e.preventDefault();
    const trimmedFullName = fullName.trim();
    const trimmedEmail = email.trim();
    const trimmedMobileNumber = mobileNumber.trim(); 

    if (selectedStoreIds.length === 0) {
        alert("Validation Error: Please select at least one store to assign to the new partner.");
        return;
    }
    
    if (!trimmedFullName || !trimmedEmail || !password || !trimmedMobileNumber) {
        alert("Validation Error: All fields (Name, Email, Password, Mobile) must be filled.");
        return;
    }
    
    if (trimmedMobileNumber.length < 10 || trimmedMobileNumber.length > 15 || !/^\d+$/.test(trimmedMobileNumber)) {
         alert("Validation Error: Mobile number appears invalid. Please enter a valid number (e.g., 10-15 digits).");
         return;
    }

    if (!accessToken) {
        alert("Authentication token is missing. Please re-login.");
        return;
    }
    
    setLoading(true);

    const partnerData = {
        full_name: trimmedFullName,
        email: trimmedEmail,
        password: password, 
        mobile_number: trimmedMobileNumber,
        stores: selectedStoreIds, 
        role: 'partner',
    };

    try {
        const response = await axios.post(
            `${API_BASE_URL}/partners/partners/superadmin/create`,
            partnerData,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        if (response.status === 201) {
            alert(`Partner ${trimmedFullName} created successfully!`);
            
            setFullName('');
            setEmail('');
            setPassword('');
            setMobileNumber('');
            setSelectedStoreIds([]);
            
            await fetchAllData(); 
            setCurrentTab('myPartners');
        }
    } catch (error) {
        console.error('Partner creation failed:', error.response?.data || error.message);
        
        let specificError = 'Failed to create partner. An unknown error occurred.';
        
        if (error.response) {
            if (error.response.data && typeof error.response.data === 'object' && Object.keys(error.response.data).length > 0) {
                 specificError = `Validation Error (422): ${JSON.stringify(error.response.data)}`;
            } else if (error.response.status === 422) {
                specificError = 'Data Validation failed (422). Check all fields are correct, unique, and not empty.';
            } else if (error.response.status === 401) {
                specificError = 'Authentication failed. Please log out and log back in.';
                localStorage.removeItem('userToken'); 
                navigate('/login/superadmin'); 
                setLoading(false);
                return;
            } else {
                specificError = `Server responded with status ${error.response.status}: ${error.response.statusText}`;
            }
        } else if (error.request) {
            specificError = 'Network Error: Could not reach the API server.';
        } else {
            specificError = error.message;
        }

        alert(`Error: ${specificError}`);
    } finally {
        setLoading(false);
    }
  };

// --- QR MANAGEMENT HANDLERS ---

    const handleGenerateQR = async () => {
        if (!accessToken) {
            alert('Authentication token not found.');
            return;
        }
        setLoading(true);
        try {
            const response = await axios.post(
                `${API_BASE_URL}/bottle/superadmin/generate-qr`,
                null, 
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                    },
                }
            );

            if (response.status === 201 || response.status === 200) {
                setGeneratedQrData(response.data);
                alert('Success: A new QR code has been generated and stored.');
                await fetchAllData();
            } else {
                const errorDetail = response.data?.detail || response.data?.message || `Server returned status ${response.status}.`;
                throw new Error(errorDetail);
            }
        } catch (error) {
            console.error('Failed to generate QR:', error.response?.data || error.message);
            alert('Error: Failed to generate QR code. Check console for details.');
        } finally {
            setLoading(false);
        }
    };
    const PartnerDetailsModal = ({ isVisible, onClose, onApprove, partner, isLoading, modalStyles }) => {
    if (!isVisible || !partner) return null;

    // Helper function to render a detail item
    const DetailItem = ({ label, value }) => (
        <div style={styles.detailItem}>
            <p style={styles.detailLabel}>{label}:</p>
            <p style={styles.detailValue}>{value || 'N/A'}</p>
        </div>
    );

    // Helper function to render an image
    const DetailImage = ({ label, imageUrl }) => (
        <div style={styles.imageItem}>
            <p style={styles.detailLabel}>{label}</p>
            {imageUrl ? (
                <a href={`${API_BASE_URL}/${imageUrl}`} target="_blank" rel="noopener noreferrer">
                    <img 
                        src={`${API_BASE_URL}/${imageUrl}`} 
                        alt={label} 
                        style={styles.detailImage} 
                    />
                </a>
            ) : (
                <p style={styles.detailValue}>No Image Uploaded</p>
            )}
        </div>
    );

    return (
        <div style={modalStyles.backdrop}>
            <div style={{ ...modalStyles.modal, width: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
                <h3 style={modalStyles.title}>Partner Approval Details</h3>
                <p style={styles.modalSubtitle}>Reviewing: **{partner.full_name}** ({partner.email})</p>

                <div style={styles.detailsGrid}>
                    {/* Column 1: Personal & Vehicle Details */}
                    <div style={styles.detailsColumn}>
                        <DetailItem label="Full Name" value={partner.full_name} />
                        <DetailItem label="Email" value={partner.email} />
                        <DetailItem label="Mobile" value={partner.mobile_number} />
                        <DetailItem label="Address" value={`${partner.current_address}, ${partner.city}, ${partner.state}`} />
                        <DetailItem label="Vehicle No." value={partner.vehicle_number} />
                        <DetailItem label="Driving License" value={partner.driving_license_number} />
                        <DetailItem label="Govt ID Type" value={partner.id_type} />
                        <DetailItem label="Govt ID No." value={partner.govt_id} />
                    </div>

                    {/* Column 2: Images */}
                    <div style={styles.detailsColumn}>
                        {/*                          * IMPORTANT: I am assuming your API returns image paths as 
                         * 'govt_id_photo_url' and 'delivery_photo_url'. 
                         * Please check your API response and change these field names if they are different!
                        */}
                        <DetailImage label="Government ID Photo" imageUrl={partner.govt_id_photo_url} />
                        <DetailImage label="Delivery Partner Photo" imageUrl={partner.delivery_photo_url} />
                    </div>
                </div>
                
                <div style={modalStyles.actions}>
                    <button type="button" onClick={onClose} style={modalStyles.cancelButton} disabled={isLoading}>
                        Cancel
                    </button>
                    <button 
                        type="button" 
                        style={modalStyles.submitButton} 
                        disabled={isLoading}
                        onClick={() => onApprove(partner.id)}
                    >
                        {isLoading ? 'Approving...' : 'Approve Partner'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const handleViewPartnerDetails = (partner) => {
    setSelectedPartnerForDetails(partner);
    setIsPartnerDetailsModalVisible(true);
  };

  const handleApprovePartner = async (partnerId) => {
    if (!accessToken) {
        alert("Authentication token is missing. Please re-login.");
        return;
    }
    if (!window.confirm(`Are you sure you want to approve this partner (ID: ${partnerId})?`)) {
        return;
    }

    setLoading(true); // Use the general loading state
    try {
        // IMPORTANT: I am assuming this API endpoint. You may need to change it.
        const response = await axios.patch(
            `${API_BASE_URL}/partners/partners/superadmin/approve-delivery-partner/${partnerId}`,
            { status: 'approved' }, // Or 'active', depending on your backend logic
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        if (response.status === 200) {
            alert('Partner approved successfully!');
            setIsPartnerDetailsModalVisible(false); // Close the modal
            setSelectedPartnerForDetails(null);
            await fetchAllData(); // Refresh all data
        } else {
            throw new Error(response.data?.message || `Server responded with status ${response.status}`);
        }
    } catch (error) {
        console.error('Partner approval failed:', error.response?.data || error.message);
        alert(`Failed to approve partner: ${error.response?.data?.detail || error.message}`);
    } finally {
        setLoading(false);
    }
  };

    const handleAssignBottlesToPartner = async (deliveryPartnerId) => {
        if (!accessToken) {
            alert('Authentication token not found.');
            return;
        }
        if (selectedBottlesToAssign.length === 0) {
            alert('Error: Please select at least one bottle to assign.');
        }

        setLoading(true);
        try {
            const response = await axios.post(
                `${API_BASE_URL}/bottle/superadmin/assign`,
                {
                    qr_codes: selectedBottlesToAssign,
                    delivery_boy_id: parseInt(deliveryPartnerId, 10),
                },
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (response.status === 200) {
                alert(`Success: ${response.data.message}`);
                setSelectedBottlesToAssign([]);
                setQrAssigning(false);
                await fetchAllData();
            } else {
                throw new Error(response.data?.detail || 'Failed to assign bottles.');
            }
        } catch (error) {
            console.error('Failed to assign bottles:', error.response?.data || error.message);
            const errorMessage = error.response?.data?.detail || error.message || 'An unexpected error occurred.';
            alert(`Error: ${errorMessage}`);
        } finally {
            setLoading(false);
        }
    };


  const handleLogout = () => {
    localStorage.removeItem('userToken');
    alert('You have been successfully logged out.');
    navigate('/login/superadmin');
  };

  const handleSelectTab = (tab) => {
    setCurrentTab(tab);
  };
  
  const renderDashboard = () => (
    <div style={styles.contentArea}>
      <div style={styles.kpiRow}>
        <StatCard 
          label="Total Orders" 
          value={totalOrders.toString()} 
          icon="📦" 
          bgColor="#E0F2F1" 
          textColor="#00796B" 
          onPress={() => handleSelectTab('orders')} 
        />
        <StatCard 
          label="Total Revenue" 
          value={`₹${totalRevenue.toLocaleString('en-IN')}`} 
          icon="💰" 
          bgColor="#FCE4EC" 
          textColor="#C2185B" 
          onPress={() => handleSelectTab('orders')} 
        />
        <StatCard 
          label="Pending Orders" 
          value={pendingOrdersCount.toString()} 
          icon="⏰" 
          bgColor="#FFF3E0" 
          textColor="#EF6C00" 
          onPress={() => handleSelectTab('orders')} 
        />
        <StatCard 
          label="New Complaints" 
          value={newComplaints.toString()} 
          icon="🚨" 
          bgColor="#FFEBEE" 
          textColor="#D32F2F" 
          onPress={() => handleSelectTab('complaints')} 
        />
        </div>

      <div style={styles.kpiRow}>
        <StatCard 
          label="Fresh Bottles in Warehouse" 
          value={freshBottlesWarehouse.toLocaleString()} 
          icon="💧" 
          bgColor="#E3F2FD" 
          textColor="#1565C0" 
          onPress={() => handleSelectTab('qrManagement')} 
        />
        <StatCard 
          label="Empty Bottles at Stores" 
          value={emptyBottlesStores.toLocaleString()} 
          icon="♻️" 
          bgColor="#FBEFF3" 
          textColor="#AD1457" 
          onPress={() => handleSelectTab('activeStoresList')} 
        />
        <StatCard 
          label="Total Vendors" 
          value={totalVendors.toString()} 
          icon="🤝" 
          bgColor="#E8F5E9" 
          textColor="#388E3C" 
          onPress={() => handleSelectTab('myPartners')} 
        />
        <StatCard 
          label="Total Delivery Partners" 
          value={totalDeliveryPartners.toString()} 
          icon="🚚" 
          bgColor="#EDE7F6" 
          textColor="#512DA8" 
          onPress={() => handleSelectTab('deliveryPartners')} 
        />
        </div>

      <div style={styles.mainContentGrid}>
        <div style={styles.chartCard}>
          <h3 style={styles.cardTitle}>Sales Performance</h3>
          {/* 🟢 CHART INTEGRATION 🟢 */}
            <MonthlyPerformanceChart data={getMonthlyOrderData} />
        </div>

        <div style={styles.activityCard}>
          <h3 style={styles.cardTitle}>Recent Activity</h3>
          <div style={styles.activityList}>
            {allOrders.slice(0, 5).map((order) => (
              <div key={order.id} style={styles.activityItem}>
                <div style={styles.activityText}>
                  Order <span style={styles.activityOrderId}>#{order.id}</span> by <span style={styles.activityCustomerName}>{order.customerName}</span>
                </div>
                <span style={{
                  ...styles.activityStatusBadge, 
                  backgroundColor: order.status === 'Delivered' ? '#4CAF50' : 
                                   order.status === 'Accepted' ? '#2196F3' : '#FF9800'
                }}>
                  {order.status}
                  </span>
              </div>
            ))}
            </div>
        </div>
      </div>

      <div style={styles.kpiRow}>
        <StatCard 
          label="Active Stores" 
          value={totalActiveStores.toString()} 
          icon="🏬" 
          bgColor="#E8F5E9" 
          textColor="#388E3C" 
          onPress={() => handleSelectTab('activeStoresList')} 
        />
        <StatCard 
          label="Monthly Revenue" 
          value={`₹${monthlyRevenue.toLocaleString('en-IN')}`} 
          icon="💸" 
          bgColor="#FBEFF3" 
          textColor="#AD1457" 
          onPress={() => handleSelectTab('orders')} 
        />
        <StatCard 
          label="Total Orders Today" 
          value={dailyOrders.toString()} 
          icon="📅" 
          bgColor="#F0F4C3" 
          textColor="#9E9D24" 
          onPress={() => handleSelectTab('orders')} 
        />
        <StatCard 
          label="Total Orders This Month" 
          value={monthlyOrdersCount.toString()} 
          icon="📈" 
          bgColor="#E1F5FE" 
          textColor="#0277BD" 
          onPress={() => handleSelectTab('orders')} 
        />
        <StatCard 
          label="Delivered Orders Today" 
          value={dailyDeliveredOrders.toString()} 
          icon="✅" 
          bgColor="#D4EDDA" 
          textColor="#155724" 
          onPress={() => handleSelectTab('orders')} 
        />
        <StatCard 
          label="Delivered Orders This Month" 
          value={monthlyDeliveredOrders.toString()} 
          icon="✔️" 
          bgColor="#CBE3F9" 
          textColor="#1E40AF" 
          onPress={() => handleSelectTab('orders')} 
        />
        </div>
    </div>
  );

  const renderOrders = () => {
    return (
      <div style={styles.contentArea}>
        <h2 style={styles.pageTitle}>All Orders</h2>
        {/* 🌟 START: Added Date Filtering & Export UI for Orders Tab (Request 2) 🌟 */}
        <div style={styles.formCard}>
            <h3 style={styles.cardTitle}>Search Orders by Date</h3>
            <div style={styles.datePickerRow}>
                <div style={styles.dateInputContainer}>
                    <input
                        type="date"
                        value={ordersStartDate}
                        onChange={(e) => setOrdersStartDate(e.target.value)}
                        style={styles.dateInput}
                    />
                </div>
                <div style={styles.dateInputContainer}>
                    <input
                        type="date"
                        value={ordersEndDate}
                        onChange={(e) => setOrdersEndDate(e.target.value)}
                        style={styles.dateInput}
                    />
                </div>
                {(ordersStartDate || ordersEndDate) && (
                    <button style={styles.clearButton} onClick={handleClearDates}>
                        ✕ Clear
                    </button>
                )}
            </div>
        </div>

        <button 
            style={{ ...styles.button, ...styles.secondaryButton, marginBottom: '20px' }} 
            onClick={handleExportOrdersToExcel} // 🛠️ FIXED: Replaced alert with function call
            disabled={loading || filteredOrders.length === 0}
        >
            {loading ? 'Processing...' : `EXPORT ${filteredOrders.length} ORDERS TO CSV`}
        </button>
        {/* 🌟 END: Added Date Filtering & Export UI 🌟 */}
        
        <div style={styles.tableCard}>
          <table style={styles.dataTable}>
            <thead>
              <tr style={styles.tableHeaderRow}>
                <th style={styles.tableHeaderCell}>Order ID</th>
                <th style={styles.tableHeaderCell}>Customer/Store</th>
                <th style={styles.tableHeaderCell}>Bottles</th>
                <th style={styles.tableHeaderCell}>Status</th>
                <th style={styles.tableHeaderCell}>Order Date</th>
                <th style={styles.tableHeaderCell}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {/* Use filteredOrders state for rendering */}
              {filteredOrders.length > 0 ? filteredOrders.map((order) => (
                <tr key={order.id} style={styles.tableRow}>
                  <td style={styles.tableCell}>{order.id}</td>
                  <td style={styles.tableCell}>{order.customerName}</td>
                  <td style={styles.tableCell}>{order.bottles}</td>
                  <td style={styles.tableCell}>
                    <span style={{
                      ...styles.activityStatusBadge, 
                      backgroundColor: order.status?.toLowerCase() === 'delivered' ? '#4CAF50' : 
                                       order.status?.toLowerCase() === 'accepted' ? '#2196F3' : 
                                       order.status?.toLowerCase() === 'pending' ? '#FF9800' :
                                       '#757575'
                    }}>
                      {order.status}
                    </span>
                  </td>
                  <td style={styles.tableCell}>{order.orderDate.toLocaleDateString()}</td>
                  <td style={styles.tableCell}>
                    {order.status?.toLowerCase() === 'pending' && (
                      <button style={styles.actionButton} onClick={() => alert(`Approve Order ${order.id}`)}>
                        Approve
                      </button>
                    )}
                  </td>
                </tr>
              )) : (
                <tr style={styles.tableRow}><td colSpan="6" style={{...styles.tableCell, textAlign: 'center'}}>No orders found. Adjust your date filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{height: '1px'}} />
      </div>
    );
  };
  
  const renderCreatePartner = () => {
    const assignedStoreIds = new Set();
    partners.forEach(partner => {
      if (partner.stores && Array.isArray(partner.stores)) {
        partner.stores.forEach(store => {
          assignedStoreIds.add(store.id);
        });
      }
    });

    const unassignedStores = stores.filter(store => !assignedStoreIds.has(store.id));
  
    return (
      <div style={styles.contentArea}>
        <h2 style={styles.pageTitle}>Create New Partner</h2>
        <div style={styles.formCard}>
          <form style={styles.form} onSubmit={handleCreatePartner}>
            <input
              style={styles.textInput}
              type="text"
              placeholder="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
            <input
              style={styles.textInput}
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              style={styles.textInput}
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <input
              style={styles.textInput}
              type="tel"
              placeholder="Mobile Number"
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
              required
            />
            <p style={styles.selectStoresTitle}>Select Store(s):</p>
            {/* Store List/Multi-Select UI */}
            <div style={styles.storeList}>
              {unassignedStores.length > 0 ? (
                unassignedStores.map((store) => (
                  <label key={store.id} style={styles.checkboxContainer}>
                    <input
                      type="checkbox"
                      checked={selectedStoreIds.includes(store.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedStoreIds(prev => [...prev, store.id]);
                        } else {
                          setSelectedStoreIds(prev => prev.filter(id => id !== store.id));
                        }
                      }}
                    />
                    <span style={styles.checkboxLabel}>{store.store_name} ({store.city})</span>
                  </label>
                ))
              ) : (
                <p style={styles.noDataText}>All stores are currently assigned to partners.</p>
              )}
            </div>
            <button 
                style={{...styles.button, ...styles.primaryButton}} 
                type="submit"
                disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Partner'}
            </button>
          </form>
        </div>
        </div>
    );
  };

  const renderMyPartners = () => {
    return (
      <div style={styles.contentArea}>
        <h2 style={styles.pageTitle}>My Partners</h2>
        <div style={styles.tableCard}>
          <table style={styles.dataTable}>
            <thead>
              <tr style={styles.tableHeaderRow}>
                <th style={styles.tableHeaderCell}>Full Name</th>
                <th style={styles.tableHeaderCell}>Email</th>
                <th style={styles.tableHeaderCell}>Stores</th>
              </tr>
                </thead>
            <tbody>
              {partners.map((partner) => (
                <tr key={partner.id} style={styles.tableRow}>
                  <td style={styles.tableCell}>{partner.full_name}</td>
                  <td style={styles.tableCell}>{partner.email}</td>
                  <td style={styles.tableCell}>
                    {partner.stores.map(s => s.store_name).join(', ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
    );
  };

  const renderDeliveryPartners = () => {
    const pendingPartners = allDeliveryPartners.filter(dp => dp.status === 'pending');
    const activePartners = allDeliveryPartners.filter(dp => dp.status === 'active' || dp.status === 'approved');
  
    return (
      <div style={styles.contentArea}>
        <h2 style={styles.pageTitle}>Delivery Partners</h2>
  
        <div style={styles.tableCard}>
          <h3 style={styles.cardTitle}>Pending Delivery Partners ({pendingPartners.length})</h3>
          <table style={styles.dataTable}>
            <thead>
              <tr style={styles.tableHeaderRow}>
                <th style={styles.tableHeaderCell}>Name</th>
                <th style={styles.tableHeaderCell}>Email</th>
              {/* --- ADDED THIS HEADER --- */}
                <th style={styles.tableHeaderCell}>Mobile</th> 
                <th style={styles.tableHeaderCell}>Actions</th>
              </tr>
                </thead>
            <tbody>
             {/* --- MODIFIED THIS SECTION --- */}
              {pendingPartners.length > 0 ? pendingPartners.map((dp) => (
                <tr key={dp.id} style={styles.tableRow}>
                  <td style={styles.tableCell}>{dp.full_name}</td>
                  <td style={styles.tableCell}>{dp.email}</td>
                {/* --- ADDED THIS CELL --- */}
                  <td style={styles.tableCell}>{dp.mobile_number || 'N/A'}</td>
                  <td style={styles.tableCell}>
                  {/* --- FIXED THIS BUTTON --- */}
                    <button 
                        style={styles.actionButton} 
                        onClick={() => handleViewPartnerDetails(dp)}
                    >
                      View & Approve
                    </button>
                  </td>
                </tr>
              )) : (
                <tr style={styles.tableRow}>
                  <td colSpan="4" style={{...styles.tableCell, textAlign: 'center'}}>No pending partners.</td>
                </tr>
              )}
             {/* --- END OF FIX --- */}
            </tbody>
          </table>
        </div>
  
        <div style={{ ...styles.tableCard, marginTop: '30px' }}>
          <h3 style={styles.cardTitle}>Active Delivery Partners ({activePartners.length})</h3>
          <table style={styles.dataTable}>
            <thead>
              <tr style={styles.tableHeaderRow}>
                <th style={styles.tableHeaderCell}>Name</th>
                <th style={styles.tableHeaderCell}>Email</th>
                <th style={styles.tableHeaderCell}>Status</th>
              </tr>
                </thead>
            <tbody>
              {activePartners.length > 0 ? activePartners.map((dp) => (
                <tr key={dp.id} style={styles.tableRow}>
                _ <td style={styles.tableCell}>{dp.full_name}</td>
                  <td style={styles.tableCell}>{dp.email}</td>
                  <td style={styles.tableCell}>
                    <span style={{...styles.activityStatusBadge, backgroundColor: '#10B981'}}>{dp.status}</span>
                  </td>
                </tr>
              )) : (
                <tr style={styles.tableRow}>
                  <td colSpan="3" style={{...styles.tableCell, textAlign: 'center'}}>No active partners.</td>
                </tr>
              )}
    _       </tbody>
          </table>
        </div>
        </div>
    );
  };

  const renderComplaints = () => {
  return (
    <div style={styles.contentArea}>
      <h2 style={styles.pageTitle}>Complaints Management</h2>
      <div style={styles.tableCard}>
        <table style={styles.dataTable}>
          <thead>
            <tr style={styles.tableHeaderRow}>
              <th style={styles.tableHeaderCell}>ID</th>
              <th style={styles.tableHeaderCell}>Subject</th>
              <th style={styles.tableHeaderCell}>Description</th>
              <th style={styles.tableHeaderCell}>Raised By</th>
              <th style={styles.tableHeaderCell}>Date</th>
              <th style={styles.tableHeaderCell}>Status</th>
              <th style={styles.tableHeaderCell}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {complaints.length > 0 ? (
              complaints.map((complaint) => (
                <tr key={complaint.id} style={styles.tableRow}>
                  <td style={styles.tableCell}>{complaint.id}</td>
                  <td style={styles.tableCell}>{complaint.subject}</td>
                  <td style={styles.tableCell}>
                    {complaint.description}
                    {complaint.photoUrl && (
                      <div style={{ marginTop: '10px' }}>
                        <a
                          href={`${API_BASE_URL}/${complaint.photoUrl}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            ...styles.actionButton,
                            backgroundColor: '#6c757d',
                            textDecoration: 'none'
                          }}
                        >
                          📷 View Attached Image
                        </a>
                      </div>
                    )}
                  </td>
                  <td style={styles.tableCell}>
                    {complaint.customerName} ({complaint.role})
                  </td>
                  <td style={styles.tableCell}>
                    {complaint.date.toLocaleDateString()}
                  </td>
                  <td style={styles.tableCell}>
                    <span
                      style={{
                        ...styles.activityStatusBadge,
                        backgroundColor:
                          complaint.status === 'Resolved'
                            ? '#4CAF50'
                            : complaint.status === 'In Progress'
                            ? '#2196F3'
                            : '#FF9800'
                      }}
                    >
                      {complaint.status}
                    </span>
                  </td>
                  <td style={styles.tableCell}>
                    {complaint.status === 'New' && (
                      <button
                        style={styles.actionButton}
                        onClick={() => handleResolveClick(complaint.id)}
                      >
                        Resolve
                      </button>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr style={styles.tableRow}>
                <td
                  colSpan="7"
                  style={{ ...styles.tableCell, textAlign: 'center' }}
                >
                  No new complaints found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

  const renderReports = () => {
    
    const handleReportDownloadLocal = (reportId) => {
        if (typeof handleReportDownload === 'function') {
            handleReportDownload(reportId);
        } else {
            alert("Download handler not fully initialized. Check console.");
        }
    };

    return (
        <div style={styles.contentArea}>
            <h2 style={styles.pageTitle}>Monthly Reports Management</h2>

            {/* Report Upload Section */}
            <div style={styles.formCard}>
                <h3 style={styles.cardTitle}>Upload Monthly Report (PDF)</h3>
                <form onSubmit={handleUploadReport} style={styles.reportUploadForm}>
                    
                    <div style={styles.reportFormGroup}>
                        <label style={styles.reportLabel}>Select Month:</label>
                        <input
                            style={styles.textInput}
                            type="month"
                            value={reportMonth}
                            onChange={(e) => setReportMonth(e.target.value)}
                            required
                        />
                    </div>

                    <div style={styles.reportFormGroup}>
                        <label style={styles.reportLabel}>Select PDF File:</label>
                        <input
                            type="file"
                            accept=".pdf"
                            onChange={handleFileChange}
                            style={styles.fileInput}
                            required
                        />
                    </div>

                    <button
                        style={{...styles.button, ...styles.primaryButton, alignSelf: 'flex-start'}}
                        type="submit"
                        disabled={uploadingReport || !selectedFile}
                    >
                        {uploadingReport ? 'Uploading...' : 'Upload Report'}
                    </button>
                </form>
            </div>

            {/* Existing Reports List */}
            <div style={styles.tableCard}>
                <div style={styles.reportsHeader}>
                    <h3 style={styles.cardTitle}>Available Reports ({reports.length})</h3>
                </div>
                
                <table style={styles.dataTable}>
                    <thead>
                        <tr style={styles.tableHeaderRow}>
                            <th style={styles.tableHeaderCell}>ID</th>
                            <th style={styles.tableHeaderCell}>File Name</th>
                            <th style={styles.tableHeaderCell}>Month/Year</th>
                            <th style={styles.tableHeaderCell}>Upload Date</th>
                            <th style={styles.tableHeaderCell}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reports.length > 0 ? reports.map((report) => (
                            <tr key={report.id} style={styles.tableRow}>
                                <td style={styles.tableCell}>{report.id}</td>
                                <td style={styles.tableCell}>{report.filename}</td>
                                <td style={styles.tableCell}>
                                    {/* FIX: Using the date formatter helper */}
                                    {formatReportMonth(report.rawMonthYear)}
                                </td>
                                <td style={styles.tableCell}>{report.uploadDate}</td>
                                <td style={styles.tableCell}>
                                    <button 
                                        onClick={() => handleReportDownloadLocal(report.id)}
                                        style={{
                                            ...styles.actionButton, 
                                            textDecoration: 'none',
                                            backgroundColor: '#2196F3', 
                                            cursor: 'pointer'
                                        }}
                                    >
                                        View PDF
                                    </button>
                                </td>
                            </tr>
                        )) : (
                            <tr style={styles.tableRow}><td colSpan="5" style={{...styles.tableCell, textAlign: 'center'}}>No monthly reports uploaded yet.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
  
// 🟢 RENDER QR MANAGEMENT FUNCTION 🟢
const renderQrManagement = () => {
    
    const handleCopyQrCode = (text) => {
        navigator.clipboard.writeText(text).then(() => {
            alert(`QR Code copied to clipboard: ${text}`);
        }).catch(err => {
            console.error('Could not copy text: ', err);
            alert('Failed to copy QR code.');
        });
    };

    const handleToggleBottleSelection = (qr_code, checked) => {
        setSelectedBottlesToAssign(prev => 
            checked 
                ? [...prev, qr_code] 
                : prev.filter(qr => qr !== qr_code)
        );
    };

    return (
        <div style={styles.contentArea}>
            <h2 style={styles.pageTitle}>QR Code Management</h2>

            <div style={styles.formCard}>
                <h3 style={styles.cardTitle}>Generate a new bottle</h3>
                <button
                    style={{...styles.button, ...styles.primaryButton}}
                    onClick={handleGenerateQR}
                    disabled={loading}
                >
                    {loading ? 'Generating...' : 'Generate New QR Code'}
                </button>
                {generatedQrData && (
                    <div style={styles.generatedQrContainer}>
                        <p style={styles.generatedQrText}>New QR Generated:</p>
                        <div style={styles.qrCodeWrapper}>
                            {/* NOTE: We use a placeholder image/text because React web QR libraries require installation */}
                            <p style={styles.qrPlaceholder}>[QR Code: {generatedQrData.qr_code}]</p>
                        </div>
                        <p style={styles.generatedQrCode}>{generatedQrData.qr_code}</p>
                        <button
                            style={styles.copyButton}
                            onClick={() => handleCopyQrCode(generatedQrData.qr_code)}
                        >
                            Copy QR Code
                        </button>
                    </div>
                )}
            </div>

            <div style={styles.formCard}>
                <h3 style={styles.cardTitle}>Assign Bottles to Delivery Partners</h3>
                <p style={styles.reportLabel}>Select Bottles to Assign ({unassignedBottles.length} available):</p>
                
                <div style={styles.bottleList}>
                    {unassignedBottles.length > 0 ? (
                        unassignedBottles.map((bottle) => (
                            <label key={bottle.UUID} style={styles.checkboxContainer}>
                                <input
                                    type="checkbox"
                                    checked={selectedBottlesToAssign.includes(bottle.qr_code)}
                                    onChange={(e) => handleToggleBottleSelection(bottle.qr_code, e.target.checked)}
                                />
                                <span style={styles.checkboxLabel}>{bottle.qr_code}</span>
                            </label>
                        ))
                    ) : (
                        <p style={styles.noDataText}>No unassigned bottles available.</p>
                    )}
                </div>

                <button
                    style={{...styles.button, ...styles.secondaryButton, backgroundColor: '#3B82F6', marginTop: '15px'}}
                    onClick={() => selectedBottlesToAssign.length > 0 ? setQrAssigning(true) : alert('Please select at least one bottle.')}
                    disabled={loading || selectedBottlesToAssign.length === 0}
                >
                    Assign Selected Bottles ({selectedBottlesToAssign.length})
                </button>
            </div>
            
             <AssignBottleModal 
                isVisible={qrAssigning}
                onClose={() => setQrAssigning(false)}
                selectedBottlesToAssign={selectedBottlesToAssign}
                approvedDeliveryPartners={approvedDeliveryPartners}
                onAssign={handleAssignBottlesToPartner}
                modalStyles={styles.modalStyles}
            />
        </div>
    );
};

// 🟢 RENDER ACTIVE STORES LIST FUNCTION 🟢
const renderActiveStoresList = () => {
    if (loading) {
      return <p style={styles.loadingText}>Loading active stores...</p>;
    }

    const activeStores = stores; 

    return (
      <div style={styles.contentArea}>
        <h2 style={styles.pageTitle}>Active Stores List ({activeStores.length})</h2>
        <div style={styles.tableCard}>
          {activeStores.length > 0 ? (
            <table style={styles.dataTable}>
              <thead>
                <tr style={styles.tableHeaderRow}>
                  <th style={styles.tableHeaderCell}>Store Name</th>
                  <th style={styles.tableHeaderCell}>City</th>
                  <th style={styles.tableHeaderCell}>Address</th>
                  <th style={styles.tableHeaderCell}>Partner(s)</th>
                  <th style={styles.tableHeaderCell}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeStores.map((store) => {
                  // Logic to find and list all partners associated with the store
                  const assignedPartners = partners.filter(partner => 
                    partner.stores.some(s => s.id === store.id)
                  );
                  const partnerNames = assignedPartners.map(p => p.full_name).join(', ') || 'N/A';

                  return (
                    <tr key={store.id} style={styles.tableRow}>
                      <td style={styles.tableCell}>{store.store_name}</td>
                      <td style={styles.tableCell}>{store.city || 'N/A'}</td>
                      <td style={styles.tableCell}>{store.address || 'N/A'}</td>
                      <td style={styles.tableCell}>{partnerNames}</td>
                      <td style={styles.tableCell}>
                        <button 
                          style={{...styles.actionButton, backgroundColor: '#00B8D9'}}
                          onClick={() => alert(`Viewing details for store ${store.store_name}`)}
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p style={{...styles.loadingText, marginTop: '20px', marginBottom: '20px'}}>
              No active stores found.
            </p>
          )}
        </div>
        </div>
    );
};


  const renderContent = () => {
    switch (currentTab) {
      case 'dashboard':
        return renderDashboard();
      case 'orders':
        return renderOrders();
      case 'createPartner':
        return renderCreatePartner();
      case 'myPartners':
        return renderMyPartners();
      case 'deliveryPartners':
        return renderDeliveryPartners();
      case 'complaints':
        return renderComplaints(); 
      case 'reports':
        return renderReports(); 
      case 'qrManagement':
        return renderQrManagement();
      case 'activeStoresList':
        return renderActiveStoresList(); 
      default:
        return renderDashboard();
    }
  };

  return (
    <div style={styles.dashboardLayout}>
      <Sidebar 
        currentTab={currentTab} 
        onSelectTab={handleSelectTab} 
      />
      <main style={styles.mainPanel}>
        <header style={styles.topHeader}>
          <h1 style={styles.headerTitle}>Super Admin Dashboard</h1>
          <div style={styles.userProfile}>
            <span style={styles.userName}>Admin User</span>
            <button style={styles.logoutButton} onClick={handleLogout}>
              Logout
            </button>
          </div>
        </header>
        <div style={styles.mainContentArea}>
          {loading && currentTab === 'dashboard' ? (
            <p style={styles.loadingText}>Loading dashboard data...</p>
          ) : (
            renderContent()
          )}
        </div>
      </main>
      
      {/* --- MODAL SECTION --- */}
      <SolutionModal 
        isVisible={isSolutionModalVisible}
        onClose={handleCloseModal}
        onSubmit={handleSolutionSubmit}
        complaintId={currentComplaintId}
        solutionText={solutionText}
        setSolutionText={setSolutionText}
        isLoading={resolvingComplaint}
        modalStyles={styles.modalStyles} 
      />

      {/* --- QR ASSIGN BOTTLE MODAL --- */}
      <AssignBottleModal 
          isVisible={qrAssigning}
          onClose={() => setQrAssigning(false)}
          selectedBottlesToAssign={selectedBottlesToAssign}
          approvedDeliveryPartners={approvedDeliveryPartners}
          onAssign={handleAssignBottlesToPartner}
          modalStyles={styles.modalStyles}
      />

      {/* --- NEW PARTNER DETAILS MODAL --- */}
      <PartnerDetailsModal
        isVisible={isPartnerDetailsModalVisible}
        onClose={() => setIsPartnerDetailsModalVisible(false)}
        onApprove={handleApprovePartner}
        partner={selectedPartnerForDetails}
        isLoading={loading}
        modalStyles={styles.modalStyles}
      />
    </div>
  );
};

const styles = {
  dashboardLayout: {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: '#F0F2F5', 
    fontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  },
  sidebar: {
    width: '260px',
    backgroundColor: '#2C3E50', 
    color: '#ECF0F1', 
    padding: '25px 0',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '4px 0 10px rgba(0,0,0,0.15)',
  },
  sidebarHeader: {
    padding: '0 25px 30px',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    marginBottom: '20px',
  },
  sidebarHeaderTitle: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#4CAF50', 
  },
  sidebarNav: {
    flexGrow: 1,
    padding: '0 15px',
  },
  sidebarItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 15px',
    borderRadius: '8px',
    marginBottom: '8px',
    backgroundColor: 'transparent',
    border: 'none',
    width: '100%',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease, color 0.2s ease',
    fontSize: '16px',
    color: '#ECF0F1',
  },
  sidebarItemActive: {
    backgroundColor: '#4CAF50', 
    color: '#FFFFFF',
    fontWeight: '600',
  },
  sidebarIcon: {
    fontSize: '20px',
    marginRight: '15px',
  },
  sidebarText: {
    // Inherits color from sidebarItem
  },
  sidebarTextActive: {
    // Inherits color from sidebarItemActive
  },
  mainPanel: {
    flexGrow: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  topHeader: {
    backgroundColor: '#FFFFFF',
    padding: '20px 30px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #E0E0E0',
  },
  headerTitle: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#333',
    margin: 0,
  },
  userProfile: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
  },
  userName: {
    fontSize: '16px',
    fontWeight: '500',
    color: '#555',
  },
  logoutButton: {
    padding: '10px 18px',
    backgroundColor: '#E74C3C', 
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
  },
  mainContentArea: {
    flexGrow: 1,
    padding: '30px',
    overflowY: 'auto',
  },
  loadingText: {
    textAlign: 'center',
    fontSize: '18px',
    marginTop: '50px',
    color: '#6B7280',
  },
  contentArea: {
    // This wrapper is for the actual content of each tab
  },
  pageTitle: {
    fontSize: '26px',
    fontWeight: '700',
    color: '#333',
    marginBottom: '25px',
    borderLeft: '5px solid #4CAF50',
    paddingLeft: '15px',
  },
  // --- Dashboard specific styles ---
  kpiRow: {
    display: 'grid',
    // Adjust grid template to accommodate 6 cards (2 rows of 3, or 2 rows of 4 + 2 rows of 2, etc.)
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '20px',
    marginBottom: '30px',
  },
  statCard: {
    borderRadius: '12px',
    padding: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    boxShadow: '0 4px 10px rgba(0,0,0,0.08)',
    cursor: 'pointer',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  },
  statIcon: {
    fontSize: '36px',
    // color inherited from statCard
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: '28px',
    fontWeight: 'bold',
    margin: '0',
  },
  statLabel: {
    fontSize: '14px',
    color: 'rgba(0,0,0,0.7)',
    margin: '0',
  },
  mainContentGrid: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr', 
    gap: '30px',
    marginBottom: '30px',
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    padding: '25px',
    boxShadow: '0 4px 10px rgba(0,0,0,0.08)',
  },
  activityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    padding: '25px',
    boxShadow: '0 4px 10px rgba(0,0,0,0.08)',
  },
  cardTitle: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#333',
    marginBottom: '20px',
    borderBottom: '1px solid #EEE',
    paddingBottom: '10px',
  },
  chartPlaceholder: {
    height: '250px',
    backgroundColor: '#F8F9FA',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '8px',
    color: '#888',
    fontSize: '16px',
    border: '1px dashed #DDD',
    flexDirection: 'column', // Allow content to stack vertically
  },
  activityList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
  },
  activityItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: '10px',
    borderBottom: '1px solid #F5F5F5',
  },
  activityText: {
    fontSize: '15px',
    color: '#555',
  },
  activityOrderId: {
    fontWeight: '600',
    color: '#4CAF50',
  },
  activityCustomerName: {
    fontWeight: '500',
    color: '#2C3E50',
  },
  activityStatusBadge: {
    padding: '5px 10px',
    borderRadius: '15px',
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: '12px',
    // backgroundColor will be set dynamically
  },

  // --- General Table and Form styles ---
  tableCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    boxShadow: '0 4px 10px rgba(0,0,0,0.08)',
    overflow: 'hidden',
    marginBottom: '30px',
    padding: 0, // Ensure table card itself has no padding to keep table full width
  },
  dataTable: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  tableHeaderRow: {
    backgroundColor: '#4CAF50', 
    color: '#FFFFFF',
    textAlign: 'left',
  },
  tableHeaderCell: {
    padding: '15px 20px',
    fontWeight: '600',
    fontSize: '14px',
  },
  tableRow: {
    borderBottom: '1px solid #ECEFF1',
    transition: 'background-color 0.2s ease',
  },
  tableCell: {
    padding: '12px 20px',
    color: '#444',
    fontSize: '14px',
  },
  actionButton: {
    padding: '8px 15px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: '#2196F3', 
    color: '#FFFFFF',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    textDecoration: 'none',
    transition: 'background-color 0.2s ease',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    padding: '30px',
    boxShadow: '0 4px 10px rgba(0,0,0,0.08)',
    marginBottom: '30px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
  },
  // 🌟 NEW STYLES FOR DATE PICKER IN ORDERS TAB 🌟
  datePickerRow: { 
    display: 'flex', 
    gap: '15px', 
    alignItems: 'center', 
    marginBottom: '15px', 
  },
  dateInputContainer: {
    position: 'relative',
    flex: 1,
  },
  dateInput: {
    width: '100%',
    padding: '12px 15px',
    borderRadius: '8px',
    border: '1px solid #DCE0E6',
    fontSize: '16px',
    color: '#333',
    outline: 'none',
    boxSizing: 'border-box',
    background: '#fff',
  },
  clearButton: { 
    background: '#F5F5F5', 
    border: '1px solid #E74C3C', 
    color: '#E74C3C', 
    fontWeight: '600', 
    borderRadius: '8px', 
    padding: '10px 15px', 
    cursor: 'pointer', 
    fontSize: '14px', 
    height: '44px', 
    flexShrink: 0,
  },

  // --- New Report Specific Styles ---
  reportsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 30px 10px',
    borderBottom: '1px solid #E0E0E0',
    marginBottom: '10px',
  },
  reportUploadForm: {
    display: 'flex',
    gap: '20px',
    alignItems: 'flex-end',
    padding: '0 0 10px 0',
  },
  reportFormGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    flex: 1,
  },
  reportLabel: {
    fontWeight: '500',
    color: '#555',
    fontSize: '14px',
  },
  fileInput: {
    border: '1px solid #DCE0E6',
    borderRadius: '8px',
    padding: '10px',
    backgroundColor: '#F8F9FA',
  },
  secondaryButton: {
    backgroundColor: '#1565C0', // Blue for export
    color: '#FFFFFF',
    padding: '10px 20px',
    borderRadius: '6px',
    border: 'none',
    fontWeight: '600',
    cursor: 'pointer',
    fontSize: '16px',
    transition: 'background-color 0.2s ease',
  },
  // --- Existing form styles adjusted for reports
  textInput: {
    padding: '12px 15px',
    borderRadius: '8px',
    border: '1px solid #DCE0E6',
    fontSize: '16px',
    color: '#333',
    outline: 'none',
    transition: 'border-color 0.2s ease',
  },
  button: {
    padding: '14px 25px',
    borderRadius: '8px',
    border: 'none',
    color: '#FFFFFF',
    fontWeight: '600',
    cursor: 'pointer',
    fontSize: '16px',
    transition: 'background-color 0.2s ease',
  },
  primaryButton: {
    backgroundColor: '#4CAF50', // Green primary button
  },
  // --- Partner Creation Store Dropdown Styles (FIXED FOR REACT) ---
    storeList: {
        maxHeight: '300px',
        overflowY: 'auto',
        border: '1px solid #DCE0E6',
        borderRadius: '8px',
        padding: '10px',
        backgroundColor: '#F8F9FA',
    },
    checkboxContainer: {
        display: 'flex',
        alignItems: 'center',
        padding: '8px 5px',
        cursor: 'pointer',
        borderBottom: '1px dashed #EEE',
    },
    checkboxLabel: {
        marginLeft: '10px',
        fontSize: '14px',
        color: '#333',
    },
  // --- QR Management Styles (PORTED AND CLEANED) ---
    generatedQrContainer: {
        marginTop: '25px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '20px',
        backgroundColor: '#F9FAFB',
        borderRadius: '10px',
        border: '1px solid #E0E0E0',
    },
    qrCodeWrapper: {
        backgroundColor: '#FFFFFF',
        padding: '10px',
        borderRadius: '8px',
        marginBottom: '15px',
        border: '1px solid #DDD',
    },
    qrPlaceholder: {
        width: '150px',
        height: '150px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#ECEFF1',
        color: '#888',
        fontSize: '12px',
        margin: 0,
    },
    generatedQrText: {
        fontSize: '18px',
        fontWeight: '600',
        color: '#333',
        marginBottom: '10px',
    },
    generatedQrCode: {
        fontSize: '16px',
        color: '#4CAF50',
        fontWeight: 'bold',
        marginBottom: '15px',
        wordBreak: 'break-all',
        textAlign: 'center',
    },
    copyButton: {
        padding: '10px 15px',
        backgroundColor: '#6B7280',
        color: '#FFFFFF',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontWeight: '600',
    },
    bottleList: {
        maxHeight: '300px', 
        overflowY: 'auto',
        border: '1px solid #E0E0E0',
        borderRadius: '8px',
        padding: '10px',
        backgroundColor: '#FFFFFF',
        marginBottom: '10px',
    },
  // --- Modal Styles ---
  modalStyles: {
    backdrop: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
    },
    modal: {
        backgroundColor: '#FFFFFF',
        padding: '30px',
        borderRadius: '12px',
        width: '400px',
        maxWidth: '90%',
        boxShadow: '0 8px 20px rgba(0, 0, 0, 0.2)',
    },
    title: {
        fontSize: '20px',
        fontWeight: '600',
        color: '#333',
        marginBottom: '20px',
    },
    textarea: {
        width: '100%',
        padding: '10px',
        borderRadius: '6px',
        border: '1px solid #DCE0E6',
        fontSize: '15px',
        resize: 'vertical',
        marginBottom: '20px',
        outline: 'none',
    },
    actions: {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '10px',
    },
    cancelButton: {
        padding: '10px 18px',
        borderRadius: '6px',
        border: '1px solid #CCC',
        backgroundColor: '#F5F5F5',
        color: '#333',
        cursor: 'pointer',
    },
    submitButton: {
        padding: '10px 18px',
        borderRadius: '6px',
        border: 'none',
        backgroundColor: '#4CAF50',
        color: '#FFFFFF',
        fontWeight: '600',
        cursor: 'pointer',
    }
  },
modalSubtitle: {
        fontSize: '16px',
        color: '#6B7280',
        marginBottom: '20px',
        textAlign: 'left',
        borderBottom: '1px solid #EEE',
        paddingBottom: '15px'
  },
  detailsGrid: {
    display: 'flex',
    flexDirection: 'row',
    gap: '20px',
  },
  detailsColumn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  detailItem: {
    display: 'flex',
    flexDirection: 'column',
  },
  detailLabel: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#555',
    margin: '0 0 4px 0',
  },
  detailValue: {
    fontSize: '15px',
    color: '#333',
    margin: '0',
    wordBreak: 'break-word',
  },
  imageItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
  },
  detailImage: {
    width: '100%',
    maxWidth: '250px',
    height: 'auto',
    borderRadius: '8px',
    border: '1px solid #DDD',
    backgroundColor: '#F8F8F8',
  }
    
};

 
export default SuperAdminDashboard;