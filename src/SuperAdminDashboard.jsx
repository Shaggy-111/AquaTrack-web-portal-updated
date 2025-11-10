import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from './config';
import { QRCodeCanvas } from "qrcode.react";


// --- Configuration ---

const BOTTLE_PRICE = 100; // Use BOTTLE_PRICE from this SuperAdmin file

// --- Helper Functions ---
const backendToUiStatus = (s) => {
  if (s === 'pending') return 'New';
  if (s === 'in_progress') return 'In Progress';
  if (s === 'delivered') return 'Delivered';
  return 'Resolved';
};
// --- Order Assignment Modal Component ---
const OrderAssignmentModal = ({ isVisible, onClose, order, approvedDeliveryPartners, onSubmit, selectedPartnerId, setSelectedPartnerId, modalStyles, styles, isLoading }) => {
    if (!isVisible || !order) return null;

    const handleAssign = (e) => {
        e.preventDefault();
        if (selectedPartnerId) {
            onSubmit(order.id, selectedPartnerId);
        } else {
            alert('Please select a delivery partner.');
        }
    };

    return (
        <div style={modalStyles.backdrop}>
            <div style={{ ...modalStyles.modal, maxHeight: '80vh', overflowY: 'auto' }}>
                <h3 style={modalStyles.title}>Assign Delivery Partner to Order #{order.id}</h3>
                <p style={styles.modalSubtitle}>Order Details: {order.bottles} bottles for {order.customerName}</p>

                <form onSubmit={handleAssign} style={styles.form}>
                    <label style={styles.reportLabel}>Select Delivery Partner:</label>
                    <select
                        style={styles.textInput}
                        value={selectedPartnerId}
                        onChange={(e) => setSelectedPartnerId(e.target.value)}
                        required
                        disabled={isLoading}
                    >
                        <option value="">-- Select Partner --</option>
                        {approvedDeliveryPartners.map(dp => (
                            <option key={dp.id} value={dp.id}>
                                {dp.full_name} ({dp.email})
                            </option>
                        ))}
                    </select>

                    <div style={modalStyles.actions}>
                        <button type="button" onClick={onClose} style={modalStyles.cancelButton} disabled={isLoading}>
                            Cancel
                        </button>
                        <button type="submit" style={modalStyles.submitButton} disabled={isLoading || !selectedPartnerId}>
                            {isLoading ? 'Assigning...' : 'Assign Order'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
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

  const normalizeStatus = (status) => {
    if (!status) return 'Pending';
    const s = status.toLowerCase().replace('-', '_');
    if (s === 'pending') return 'Pending';
    if (s === 'accepted') return 'Accepted';
    if (s === 'in_transit') return 'In Transit';
    if (s === 'delivered') return 'Delivered';
    if (s === 'cancelled') return 'Cancelled';
    if (s === 'assigned') return 'Assigned';
    return status; // fallback
  };

  return apiData.map(item => ({
    id: String(item.id),
    bottles: parseInt(item.order_details, 10),
    status: normalizeStatus(item.status),
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
  const [currentTab, setCurrentTab] = useState("dashboard");
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
  const [pendingDeliveryPartnersCount, setPendingDeliveryPartnersCount] =
    useState(0);

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

  const [isStoreDetailsModalVisible, setIsStoreDetailsModalVisible] = useState(false);
  const [selectedStoreForDetails, setSelectedStoreForDetails] = useState(null);

  
  const [loadingQR, setLoadingQR] = useState(false);


  const [newStoreName, setNewStoreName] = useState("");
  const [newStoreCity, setNewStoreCity] = useState("");
  const [newStoreAddress, setNewStoreAddress] = useState("");
  const [newStoreLat, setNewStoreLat] = useState("");
  const [newStoreLong, setNewStoreLong] = useState("");


  const [qrSummary, setQrSummary] = useState({});


  



  // --- QR Management Handlers ---
  const handleGenerateQR = async () => {
    try {
      setLoading(true);

      const token =
        accessToken ||
        localStorage.getItem('auth_token') ||
        localStorage.getItem('userToken') ||
        localStorage.getItem('partner_token');

      if (!token) {
        alert('Authentication Required. Please log in to access the dashboard.');
        navigate('/login/superadmin');
        return;
      }

      const res = await fetch(`${API_BASE_URL}/bottle/superadmin/generate-qr`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        // mirror the TSX error parsing
        let message = `Server error: ${res.status} ${res.statusText}`;
        try {
          const err = await res.json();
          if (Array.isArray(err.detail)) message = err.detail.map(d => d.msg).join('; ');
          else if (typeof err.detail === 'string') message = err.detail;
        } catch { }
        throw new Error(message);
      }

      const data = await res.json();
      setGeneratedQrData(data);
      alert('A new QR code has been generated and stored.');
      await fetchAllData();
    } catch (e) {
      console.error('Failed to generate QR:', e);
      alert(e.message || 'Failed to generate QR code.');
    } finally {
      setLoading(false);
    }
  };


  // --- Core Data States ---
  const [partners, setPartners] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  const [allDeliveryPartners, setAllDeliveryPartners] = useState([]);
  const [approvedDeliveryPartners, setApprovedDeliveryPartners] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [isSolutionModalVisible, setIsSolutionModalVisible] = useState(false);
  const [currentComplaintId, setCurrentComplaintId] = useState(null);
  const [solutionText, setSolutionText] = useState("");
  const [resolvingComplaint, setResolvingComplaint] = useState(false);

  // --- Partner Details Modal ---
  const [isPartnerDetailsModalVisible, setIsPartnerDetailsModalVisible] =
    useState(false);
  const [selectedPartnerForDetails, setSelectedPartnerForDetails] =
    useState(null);

  // --- Report Management States ---
  const [reports, setReports] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadingReport, setUploadingReport] = useState(false);
  const [reportMonth, setReportMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );

  // --- New Partner Creation Form States ---
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [stores, setStores] = useState([]);
  const [selectedStoreIds, setSelectedStoreIds] = useState([]);

  const [accessToken, setAccessToken] = useState(null);

  // 🌟 NEW STATES FOR DATE FILTERING IN ORDERS TAB 🌟
  const [ordersStartDate, setOrdersStartDate] = useState("");
  const [ordersEndDate, setOrdersEndDate] = useState("");
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [isOrderAssigningModalVisible, setIsOrderAssigningModalVisible] =
    useState(false);
  const [orderToAssign, setOrderToAssign] = useState(null); // The Order object
  const [selectedDeliveryPartnerId, setSelectedDeliveryPartnerId] =
    useState("");

  // --- EFFECT: Update filtered orders whenever filters or data change ---
  useEffect(() => {
    let filtered = allOrders;

    if (ordersStartDate && ordersEndDate) {
      const start = new Date(ordersStartDate);
      const end = new Date(ordersEndDate);
      end.setHours(23, 59, 59, 999); // include the entire end date

      filtered = allOrders.filter((order) => {
        const orderDate = new Date(order.orderDate);
        return orderDate >= start && orderDate <= end;
      });
    }

    setFilteredOrders(filtered);
  }, [ordersStartDate, ordersEndDate, allOrders]);

  const handleClearDates = () => {
    setOrdersStartDate("");
    setOrdersEndDate("");
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
      const token =
        localStorage.getItem('auth_token') ||
        localStorage.getItem('userToken') ||
        localStorage.getItem('partner_token');

      if (!token) {
        alert('Authentication Required. Please log in to access the dashboard.');
        navigate('/login/superadmin');
        return;
      }
      setAccessToken(token);


      const authHeaders = {
        headers: { Authorization: `Bearer ${token}` },
      };

      // 1️⃣ Detect role (from localStorage or token)
      const userRole =
        localStorage.getItem('user_role') ||
        localStorage.getItem('role') ||
        'superadmin';

      // 2️⃣ Define API calls conditionally
      const promises = [
        axios.get(`${API_BASE_URL}/superadmin/orders/all`, authHeaders),          // [0] All Orders
        axios.get(`${API_BASE_URL}/superadmin/orders/pending`, authHeaders),      // [1] Pending Orders
        axios.get(`${API_BASE_URL}/store/list`, authHeaders),               // [2] Stores List
        axios.get(`${API_BASE_URL}/partners/partners/list`, authHeaders),         // [3] Partners List
        axios.get(`${API_BASE_URL}/partners/partners/superadmin/delivery-partners`, authHeaders), // [4] Delivery Partners
        axios.get(`${API_BASE_URL}/bottle/superadmin/unassigned-bottles`, authHeaders), // [5] Unassigned Bottles
        axios.get(`${API_BASE_URL}/complaints/complaints/assigned`, authHeaders), // [6] Complaints

        // ✅ Only call this if role is partner — otherwise skip
        userRole === 'partner'
          ? axios.get(`${API_BASE_URL}/bottle/partner/me/empty-bottles`, authHeaders)
          : Promise.resolve({ data: { total_empty_bottles: 0 } }),                // [7] Empty Bottles (default)

        axios.get(`${API_BASE_URL}/reports/reports/list`, authHeaders),           // [8] Reports List
      ];

      // 3️⃣ Wait for all promises to settle (resolve or reject)
      const results = await Promise.allSettled(promises);

      // 4️⃣ Helper to safely get data or null
      const getData = (index) => {
        const result = results[index];
        if (result.status === 'fulfilled') {
          return result.value.data;
        } else {
          console.warn(
            `API at index ${index} failed:`,
            result.reason?.response?.data || result.reason?.message
          );

          // Handle token expiry
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



const fetchQrData = async () => {
  try {
    // ✅ FIX: Use the correct token keys from your login
    const token =
      localStorage.getItem('auth_token') ||
      localStorage.getItem('userToken') ||
      localStorage.getItem('partner_token') ||
      accessToken;

    if (!token) {
      console.error("QR data fetch skipped: No token found.");
      return; 
    }

    const headers = { Authorization: `Bearer ${token}` };

    // Fetch both summary and unassigned bottles at the same time
    const [summaryRes, unassignedRes] = await Promise.allSettled([
      axios.get(`${API_BASE_URL}/bottle/superadmin/summary`, { headers }),
      axios.get(`${API_BASE_URL}/bottle/superadmin/unassigned-bottles`, { headers }),
    ]);

    // Process summary
    if (summaryRes.status === 'fulfilled') {
        setQrSummary(summaryRes.value.data || {});
    } else {
        console.error("Failed to fetch QR summary:", summaryRes.reason);
    }
    
    // Process unassigned bottles
    if (unassignedRes.status === 'fulfilled') {
        const mappedBottles = (unassignedRes.value.data || []).map((bottle) => ({
                UUID: bottle.uuid,
                qr_code: bottle.qr_code,
            }));
            setUnassignedBottles(mappedBottles);
    } else {
        console.warn("Failed to fetch unassigned bottles:", unassignedRes.reason);
    }

  } catch (error) {
    console.error("Error in fetchQrData:", error);
  }
};


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
    "Order Date & Time",
    "Delivery Partner",
  ];

  const csvData = filteredOrders.map(order => {
    const isDelivered = order.status?.toLowerCase() === 'delivered';
    const revenue = isDelivered ? order.bottles * BOTTLE_PRICE : 0;

    const escape = (value) => `"${String(value).replace(/"/g, '""')}"`;

    const orderDateTime = `${order.orderDate.toLocaleDateString()} ${order.orderDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}`;

    return [
      escape(order.id),
      escape(order.customerName),
      escape(order.isPartnerOrder ? 'Yes' : 'No'),
      order.bottles,
      revenue,
      escape(order.status),
      escape(orderDateTime),
      escape(order.deliveryPartnerName),
    ].join(',');
  });

  const csvContent = [headers.join(','), ...csvData].join('\n');

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
// ------------------------------------------
// --- ORDER APPROVAL HANDLER ---
// ------------------------------------------
// ------------------------------------------
// --- DELIVERY PARTNER APPROVAL HANDLER ---
// ------------------------------------------
// ------------------------------------------
// --- DELIVERY PARTNER APPROVAL HANDLER ---
// ------------------------------------------
const handleApproveDeliveryPartner = async (partnerId) => {
  // Step 1: Get valid token (handles all key names)
  const token =
    accessToken ||
    localStorage.getItem('auth_token') ||
    localStorage.getItem('userToken') ||
    localStorage.getItem('partner_token');

  if (!token) {
    alert('Authentication token missing. Please login again.');
    navigate('/login/superadmin');
    return;
  }

  // Step 2: Confirm approval
  if (!window.confirm(`Are you sure you want to approve this Delivery Partner (ID: ${partnerId})?`))
    return;

  setLoading(true);
  try {
    // Step 3: Use backend API
    const response = await axios.patch(
      `${API_BASE_URL}/partners/partners/superadmin/delivery-partners/${partnerId}/approve`,
      {}, // empty body
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );

    if (response.status === 200 || response.status === 204) {
      alert('✅ Delivery Partner approved successfully!');
      await fetchAllData(); // refresh
    } else {
      console.error('Unexpected response:', response.status, response.data);
      alert(`Unexpected server response: ${response.status}`);
    }
  } catch (error) {
    console.error('❌ Partner approval failed:', error.response?.data || error.message);
    if (error.message.includes('Network Error')) {
      alert('Network error: possible CORS issue.');
    } else if (error.response?.status === 401) {
      alert('Session expired. Please log in again.');
      navigate('/login/superadmin');
    } else {
      alert(`Failed to approve: ${error.response?.data?.detail || error.message}`);
    }
  } finally {
    setLoading(false);
  }
};

const handleApproveOrder = async (orderId) => {
  const token =
    accessToken ||
    localStorage.getItem('auth_token') ||
    localStorage.getItem('userToken') ||
    localStorage.getItem('partner_token');

  if (!token) {
    alert('Authentication token missing. Please log in again.');
    navigate('/login/superadmin');
    return;
  }

  if (!window.confirm(`Are you sure you want to approve Order #${orderId}?`)) {
    return;
  }

  setLoading(true);
  try {
    const response = await axios.patch(
      `${API_BASE_URL}/superadmin/orders/${orderId}/approve`, // ✅ fixed endpoint
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.status === 200 || response.status === 204) {
      alert(`✅ Order #${orderId} approved successfully!`);
      await fetchAllData(); // refresh the table
    } else {
      throw new Error(`Unexpected server response: ${response.status}`);
    }
  } catch (error) {
    console.error('Order approval failed:', error.response?.data || error.message);
    alert(
      error.response?.data?.detail ||
        `Failed to approve order: ${error.message}`
    );
  } finally {
    setLoading(false);
  }
};


// ------------------------------------------
// --- ORDER ASSIGNMENT HANDLERS ---
// ------------------------------------------
const handleAssignClick = (order) => {
  setOrderToAssign(order);
  setIsOrderAssigningModalVisible(true);
  setSelectedDeliveryPartnerId(''); // reset
};

const handleAssignOrderSubmit = async () => {
  if (!orderToAssign || !selectedDeliveryPartnerId) {
    alert('Missing order or delivery partner info.');
    return;
  }

  const token =
    accessToken ||
    localStorage.getItem('auth_token') ||
    localStorage.getItem('userToken') ||
    localStorage.getItem('partner_token');

  if (!token) {
    alert('Authentication token not found. Please log in.');
    navigate('/login/superadmin');
    return;
  }

  setLoading(true);
  try {
    const response = await axios.patch(
      `${API_BASE_URL}/partners/partners/superadmin/orders/${orderToAssign.id}/assign/${selectedDeliveryPartnerId}`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (response.status === 200) {
      alert(`Order ${orderToAssign.id} successfully assigned.`);
      setIsOrderAssigningModalVisible(false);
      setOrderToAssign(null);
      setSelectedDeliveryPartnerId('');
      fetchAllData();
    } else {
      throw new Error(response.data?.detail || `Server responded with ${response.status}`);
    }
  } catch (error) {
    console.error('Order assignment failed:', error.response?.data || error.message);
    alert(`Failed to assign order: ${error.response?.data?.detail || error.message}`);
  } finally {
    setLoading(false);
  }
};

const handleAddStore = async (e) => {
  e.preventDefault();
  const token = accessToken || localStorage.getItem("auth_token");

  if (!token) {
    alert("Authentication token missing.");
    navigate("/login/superadmin");
    return;
  }

  try {
    setLoading(true);
    const body = {
      store_name: newStoreName,
      city: newStoreCity,
      address: newStoreAddress,
      latitude: parseFloat(newStoreLat) || null,
      longitude: parseFloat(newStoreLong) || null,
    };
    const res = await axios.post(`${API_BASE_URL}/store/create`, body, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 201) {
      alert("✅ Store added successfully!");
      setNewStoreName("");
      setNewStoreCity("");
      setNewStoreAddress("");
      setNewStoreLat("");
      setNewStoreLong("");
      await fetchAllData();
    }
  } catch (err) {
    console.error("Error adding store:", err.response?.data || err.message);
    alert(err.response?.data?.detail || "Failed to add store.");
  } finally {
    setLoading(false);
  }
};

const handleDeleteStore = async (storeId) => {
  const token = accessToken || localStorage.getItem("auth_token");
  if (!token) {
    alert("Authentication token missing.");
    navigate("/login/superadmin");
    return;
  }

  if (!window.confirm("Are you sure you want to delete this store?")) return;

  try {
    setLoading(true);
    const res = await axios.delete(`${API_BASE_URL}/store/${storeId}/delete`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 200 || res.status === 204) {
      alert("Store deleted successfully!");
      await fetchAllData();
    }
  } catch (err) {
    console.error("Delete failed:", err.response?.data || err.message);
    alert(err.response?.data?.detail || "Failed to delete store.");
  } finally {
    setLoading(false);
  }
};

// ------------------------------------------
// --- BOTTLE ASSIGNMENT HANDLER (Fix) ---
// ------------------------------------------
  // Assign bottles to a delivery partner — TSX-aligned
  const handleAssignBottlesToPartner = async (deliveryPartnerId) => {
    const token =
      accessToken ||
      localStorage.getItem('auth_token') ||
      localStorage.getItem('userToken') ||
      localStorage.getItem('partner_token');

    if (!token) {
      alert('Authentication token not found. Please log in again.');
      navigate('/login/superadmin');
      return;
    }
    if (!selectedBottlesToAssign || selectedBottlesToAssign.length === 0) {
      alert('Please select at least one bottle to assign.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/bottle/superadmin/assign`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          qr_codes: selectedBottlesToAssign,
          delivery_boy_id: parseInt(deliveryPartnerId, 10),
        }),
      });

      if (!res.ok) {
        let message = `Server error: ${res.status} ${res.statusText}`;
        try {
          const err = await res.json();
          if (Array.isArray(err.detail)) message = err.detail.map(d => d.msg).join('; ');
          else if (typeof err.detail === 'string') message = err.detail;
        } catch { }
        throw new Error(message);
      }

      const result = await res.json();
      alert(result.message || 'Assigned successfully!');
      setQrAssigning(false);
      setSelectedBottlesToAssign([]);
      await fetchAllData();
    } catch (e) {
      console.error('Failed to assign bottles:', e);
      alert(e.message || 'Failed to assign bottles.');
    } finally {
      setLoading(false);
    }
  };


  // ------------------------------------------
// --- PARTNER APPROVAL HANDLER ---
// ------------------------------------------
const handleApprovePartner = async (partnerId) => {
    try {
      setLoading(true);

      const token =
        accessToken ||
        localStorage.getItem('auth_token') ||
        localStorage.getItem('userToken') ||
        localStorage.getItem('partner_token');

      if (!token) {
        alert('Authentication token is missing. Please login again.');
        navigate('/login/superadmin');
        return;
      }

      // Confirm approval
      if (!window.confirm(`Are you sure you want to approve this partner (ID: ${partnerId})?`))
        return;

      const response = await axios.patch(
        `${API_BASE_URL}/partners/partners/superadmin/approve-delivery-partner/${partnerId}`,
        { status: 'approved' },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.status === 200 || response.status === 201) {
        alert('✅ Partner approved successfully!');
        setIsPartnerDetailsModalVisible(false);
        setSelectedPartnerForDetails(null);
        await fetchAllData();
      } else {
        console.error('Unexpected response:', response.status, response.data);
        alert(`Unexpected response from server: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Partner approval failed:', error.response?.data || error.message);

      if (error.response?.status === 401) {
        alert('Session expired. Please login again.');
        navigate('/login/superadmin');
      } else {
        alert(`Failed to approve partner: ${error.response?.data?.detail || error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const PartnerDetailsModal = ({
    isVisible,
    onClose,
    onApprove,
    partner,
    isLoading,
    modalStyles
  }) => {
    if (!isVisible || !partner) return null;

    return (
      <div style={modalStyles.backdrop}>
        <div
          style={{
            ...modalStyles.modal,
            width: '600px',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}
        >
          <h3 style={modalStyles.title}>Partner Approval Details</h3>
          <p style={{ fontWeight: 500, color: '#444' }}>
            Reviewing: <b>{partner.full_name}</b> ({partner.email})
          </p>

          {/* The partner detail grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '10px' }}>
            <div>
              <p><b>Full Name:</b> {partner.full_name}</p>
              <p><b>Email:</b> {partner.email}</p>
              <p><b>Mobile:</b> {partner.mobile_number}</p>
              <p><b>Address:</b> {partner.current_address}</p>
              <p><b>Vehicle No:</b> {partner.vehicle_number}</p>
              <p><b>License No:</b> {partner.driving_license_number}</p>
              <p><b>ID Type:</b> {partner.id_type}</p>
              <p><b>ID Number:</b> {partner.govt_id}</p>
            </div>
            <div>
              {partner.govt_id_photo_url && (
                <div>
                  <p><b>Government ID Photo:</b></p>
                  <a
                    href={`${API_BASE_URL}/${partner.govt_id_photo_url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <img
                      src={`${API_BASE_URL}/${partner.govt_id_photo_url}`}
                      alt="Govt ID"
                      style={{ width: '100%', borderRadius: 8 }}
                    />
                  </a>
                </div>
              )}
              {partner.delivery_photo_url && (
                <div style={{ marginTop: 10 }}>
                  <p><b>Partner Photo:</b></p>
                  <a
                    href={`${API_BASE_URL}/${partner.delivery_photo_url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <img
                      src={`${API_BASE_URL}/${partner.delivery_photo_url}`}
                      alt="Partner"
                      style={{ width: '100%', borderRadius: 8 }}
                    />
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Buttons */}
          <div style={modalStyles.actions}>
            <button onClick={onClose} style={modalStyles.cancelButton} disabled={isLoading}>
              Cancel
            </button>
            <button
              onClick={() => onApprove(partner.id)}
              style={modalStyles.submitButton}
              disabled={isLoading}
            >
              {isLoading ? 'Approving...' : 'Approve Partner'}
            </button>
          </div>
        </div>
      </div>
    );
  };


  const StoreDetailsModal = ({ isVisible, onClose, store, partners, modalStyles }) => {
  if (!isVisible || !store) return null;

  // Find assigned partners
  const assignedPartners = partners.filter(p =>
    p.stores.some(s => s.id === store.id)
  );
  const partnerNames = assignedPartners.map(p => p.full_name).join(', ') || 'N/A';

  return (
    <div style={modalStyles.backdrop}>
      <div style={{ ...modalStyles.modal, width: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 style={modalStyles.title}>Store Details</h3>
        <div style={styles.detailsGrid}>
          <div style={styles.detailsColumn}>
            <div style={styles.detailItem}>
              <p style={styles.detailLabel}>Store Name:</p>
              <p style={styles.detailValue}>{store.store_name}</p>
            </div>
            <div style={styles.detailItem}>
              <p style={styles.detailLabel}>City:</p>
              <p style={styles.detailValue}>{store.city}</p>
            </div>
            <div style={styles.detailItem}>
              <p style={styles.detailLabel}>Address:</p>
              <p style={styles.detailValue}>{store.address || 'N/A'}</p>
            </div>
            <div style={styles.detailItem}>
              <p style={styles.detailLabel}>Latitude:</p>
              <p style={styles.detailValue}>{store.latitude || 'N/A'}</p>
            </div>
            <div style={styles.detailItem}>
              <p style={styles.detailLabel}>Longitude:</p>
              <p style={styles.detailValue}>{store.longitude || 'N/A'}</p>
            </div>
            <div style={styles.detailItem}>
              <p style={styles.detailLabel}>Partner(s):</p>
              <p style={styles.detailValue}>{partnerNames}</p>
            </div>
          </div>
        </div>

        <div style={modalStyles.actions}>
          <button onClick={onClose} style={modalStyles.cancelButton}>Close</button>
        </div>
      </div>
    </div>
  );
};



// ------------------------------------------
// --- REPORT UPLOAD / DOWNLOAD HANDLERS ---
// ------------------------------------------
const handleUploadReport = async (e) => {
  e.preventDefault();

  const token =
    accessToken ||
    localStorage.getItem('auth_token') ||
    localStorage.getItem('userToken') ||
    localStorage.getItem('partner_token');

  if (!selectedFile || !reportMonth) {
    alert('Please select a PDF file and choose the month.');
    return;
  }
  if (!token) {
    alert('Authentication token missing. Please log in again.');
    navigate('/login/superadmin');
    return;
  }

  setUploadingReport(true);
  const formData = new FormData();
  const isoDateString = `${reportMonth}-01`;
  formData.append('report_file', selectedFile);
  formData.append('report_date', isoDateString);

  try {
    const response = await axios.post(`${API_BASE_URL}/reports/reports/upload`, formData, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status >= 200 && response.status < 300) {
      alert('Monthly report uploaded successfully!');
      setSelectedFile(null);
      e.target.reset();
      await fetchAllData();
    } else {
      throw new Error(`Server responded with status ${response.status}`);
    }
  } catch (error) {
    console.error('Report upload failed:', error.response?.data || error.message);
    const errMsg =
      error.response?.data?.message ||
      error.response?.data?.detail ||
      `Upload failed: ${error.message}`;
    alert(errMsg);
  } finally {
    setUploadingReport(false);
  }
};

const handleReportDownload = async (reportId) => {
  const token =
    accessToken ||
    localStorage.getItem('auth_token') ||
    localStorage.getItem('userToken') ||
    localStorage.getItem('partner_token');

  if (!token) {
    alert('Authentication required to download file.');
    navigate('/login/superadmin');
    return;
  }

  try {
    const response = await axios.get(`${API_BASE_URL}/reports/reports/download/${reportId}`, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'blob',
    });

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
      alert(`Download failed: ${response.status}`);
    }
  } catch (error) {
    console.error('Download failed:', error.response?.data || error.message);
    alert('File download failed. Check API endpoint or authorization.');
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

  const token =
    accessToken ||
    localStorage.getItem('auth_token') ||
    localStorage.getItem('userToken') ||
    localStorage.getItem('partner_token');

  const trimmedText = solutionText.trim();

  if (!trimmedText) {
    alert('Please enter a resolution message.');
    return;
  }
  if (!currentComplaintId || !token) {
    alert('Authentication missing or invalid.');
    navigate('/login/superadmin');
    return;
  }

  setResolvingComplaint(true);
  try {
    const payload = { status: 'resolved', solution: trimmedText };
    const response = await axios.patch(
      `${API_BASE_URL}/complaints/complaints/${currentComplaintId}/resolve`,
      payload,
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );

    if (response.status === 200) {
      alert(`Complaint #${currentComplaintId} successfully resolved.`);
      handleCloseModal();
      await fetchAllData();
    } else {
      throw new Error(`Server responded with ${response.status}`);
    }
  } catch (error) {
    console.error('Complaint resolution failed:', error.response?.data || error.message);
    alert(`Failed: ${error.response?.data?.detail || error.message}`);
  } finally {
    setResolvingComplaint(false);
  }
};

// ------------------------------------------
// --- PARTNER CREATION HANDLER ---
// ------------------------------------------
const handleCreatePartner = async (e) => {
  e.preventDefault();
  const trimmedFullName = fullName.trim();
  const trimmedEmail = email.trim();
  const trimmedMobile = mobileNumber.trim();

  const token =
    accessToken ||
    localStorage.getItem('auth_token') ||
    localStorage.getItem('userToken') ||
    localStorage.getItem('partner_token');

  if (!trimmedFullName || !trimmedEmail || !password || !trimmedMobile) {
    alert('All fields are required.');
    return;
  }
  if (selectedStoreIds.length === 0) {
    alert('Please select at least one store.');
    return;
  }
  if (!token) {
    alert('Authentication token missing.');
    navigate('/login/superadmin');
    return;
  }

  setLoading(true);
  const partnerData = {
    full_name: trimmedFullName,
    email: trimmedEmail,
    password,
    mobile_number: trimmedMobile,
    stores: selectedStoreIds,
    role: 'partner',
  };

  try {
    const response = await axios.post(
      `${API_BASE_URL}/partners/partners/superadmin/create`,
      partnerData,
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
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
    alert(`Error: ${error.response?.data?.detail || error.message}`);
  } finally {
    setLoading(false);
  }
};

// ------------------------------------------
// --- LOGOUT HANDLER ---
// ------------------------------------------
const handleLogout = () => {
  ['auth_token', 'userToken', 'partner_token', 'user_role', 'store_id', 'store_name'].forEach((k) =>
    localStorage.removeItem(k)
  );
  alert('You have been successfully logged out.');
  navigate('/login/superadmin');
};

  const handleSelectTab = (tabName) => {
    setCurrentTab(tabName);

    // 🚀 Auto-fetch data when QR tab opens
    if (tabName === "qrManagement") {
      fetchQrData(); // ✅ Call the main QR fetch function
    }
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
  const pendingOrders = filteredOrders.filter(
    (order) => order.status?.toLowerCase() === "pending"
  );
  const pendingForApprovalOrders = filteredOrders.filter(
    (order) => order.status?.toLowerCase() === "pending_for_approval"
  );
  const otherOrders = filteredOrders.filter(
    (order) =>
      order.status?.toLowerCase() !== "pending" &&
      order.status?.toLowerCase() !== "pending_for_approval"
  );

  const renderTable = (orders, title, color = "#4CAF50") => (
    <div style={{ ...styles.tableCard, marginBottom: "30px" }}>
      <h3 style={{ ...styles.cardTitle, color }}>{title} ({orders.length})</h3>
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
          {orders.length > 0 ? (
            orders.map((order) => (
              <tr key={order.id} style={styles.tableRow}>
                <td style={styles.tableCell}>{order.id}</td>
                <td style={styles.tableCell}>{order.customerName}</td>
                <td style={styles.tableCell}>{order.bottles}</td>
                <td style={styles.tableCell}>
                  <span
                    style={{
                      ...styles.activityStatusBadge,
                      backgroundColor:
                        order.status?.toLowerCase() === "delivered"
                          ? "#4CAF50"
                          : order.status?.toLowerCase() === "accepted"
                          ? "#2196F3"
                          : order.status?.toLowerCase() === "pending"
                          ? "#FF9800"
                          : "#757575",
                    }}
                  >
                    {order.status}
                  </span>
                </td>
                <td style={styles.tableCell}>
                  {order.orderDate.toLocaleDateString()}
                </td>
                <td style={styles.tableCell}>
                  {order.status?.toLowerCase() === "pending" && (
                    <button
                      onClick={() => handleApproveOrder(order.id)}
                      style={{
                        ...styles.actionButton,
                        backgroundColor: "#3B82F6",
                      }}
                      disabled={loading}
                    >
                      Approve
                    </button>
                  )}
                  {order.status?.toLowerCase() === "pending_for_approval" && (
                    <button
                      onClick={() => handleApproveOrder(order.id)}
                      style={{
                        ...styles.actionButton,
                        backgroundColor: "#6366F1",
                      }}
                      disabled={loading}
                    >
                      Approve Now
                    </button>
                  )}
                  {(order.status?.toLowerCase() === "accepted" &&
                    !order.deliveryPartnerId) && (
                    <button
                      onClick={() => handleAssignClick(order)}
                      style={{
                        ...styles.actionButton,
                        backgroundColor: "#F59E0B",
                      }}
                      disabled={loading}
                    >
                      Assign Partner
                    </button>
                  )}
                  {order.deliveryPartnerName &&
                    order.status?.toLowerCase() !== "delivered" && (
                      <span
                        style={{
                          fontSize: "12px",
                          color: "#10B981",
                          display: "block",
                          marginTop: "5px",
                        }}
                      >
                        Assigned: {order.deliveryPartnerName}
                      </span>
                    )}
                </td>
              </tr>
            ))
          ) : (
            <tr style={styles.tableRow}>
              <td
                colSpan="6"
                style={{ ...styles.tableCell, textAlign: "center" }}
              >
                No {title.toLowerCase()} found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div style={styles.contentArea}>
      <h2 style={styles.pageTitle}>Orders Overview</h2>

      {/* Date Filter Section */}
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

      {/* Export Button */}
      <button
        style={{
          ...styles.button,
          ...styles.secondaryButton,
          marginBottom: "20px",
        }}
        onClick={handleExportOrdersToExcel}
        disabled={loading || filteredOrders.length === 0}
      >
        {loading
          ? "Processing..."
          : `EXPORT ${filteredOrders.length} ORDERS TO CSV`}
      </button>

      {/* 🟢 Pending and Pending for Approval Orders on Top */}
      {renderTable(pendingForApprovalOrders, "Pending for Approval Orders", "#6366F1")}
      {renderTable(pendingOrders, "Pending Orders", "#F59E0B")}
      {renderTable(otherOrders, "All Other Orders")}
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

      {/* ---------- Pending Delivery Partners ---------- */}
      <div style={styles.tableCard}>
        <h3 style={styles.cardTitle}>Pending Delivery Partners ({pendingPartners.length})</h3>
        <table style={styles.dataTable}>
          <thead>
            <tr style={styles.tableHeaderRow}>
              <th style={styles.tableHeaderCell}>Name</th>
              <th style={styles.tableHeaderCell}>Email</th>
              <th style={styles.tableHeaderCell}>Mobile</th>
              <th style={styles.tableHeaderCell}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pendingPartners.length > 0 ? (
              pendingPartners.map((dp) => (
                <tr key={dp.id} style={styles.tableRow}>
                  <td style={styles.tableCell}>{dp.full_name}</td>
                  <td style={styles.tableCell}>{dp.email}</td>
                  <td style={styles.tableCell}>{dp.mobile_number || 'N/A'}</td>
                  <td style={styles.tableCell}>
                    {/* ✅ Correct Approve Button */}
                    <button
                      onClick={() => handleApproveDeliveryPartner(dp.id)}
                      disabled={loading}
                      style={{
                        backgroundColor: loading ? '#ccc' : '#28a745',
                        color: 'white',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: 'none',
                        cursor: loading ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {loading ? 'Approving...' : 'Approve'}
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr style={styles.tableRow}>
                <td colSpan="4" style={{ ...styles.tableCell, textAlign: 'center' }}>
                  No pending partners.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ---------- Active Delivery Partners ---------- */}
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
            {activePartners.length > 0 ? (
              activePartners.map((dp) => (
                <tr key={dp.id} style={styles.tableRow}>
                  <td style={styles.tableCell}>{dp.full_name}</td>
                  <td style={styles.tableCell}>{dp.email}</td>
                  <td style={styles.tableCell}>
                    <span style={{ ...styles.activityStatusBadge, backgroundColor: '#10B981' }}>
                      {dp.status}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr style={styles.tableRow}>
                <td colSpan="3" style={{ ...styles.tableCell, textAlign: 'center' }}>
                  No active partners.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ==========================
// 🔹 QR MANAGEMENT SECTION
// ==========================
const renderQrManagement = () => (
  <div style={styles.contentArea}>
    <h2 style={styles.pageTitle}>QR Management</h2>

    {/* 🔹 Summary Cards */}
    <div style={styles.kpiRow}>
      <StatCard
        label="Total Fresh Bottles in Warehouse"
        value={freshBottlesWarehouse.toLocaleString()}
        icon="💧"
        bgColor="#E3F2FD"
        textColor="#1565C0"
      />
      <StatCard
        label="Total Unassigned Bottles"
        value={unassignedBottles.length.toLocaleString()}
        icon="📦"
        bgColor="#FFF3E0"
        textColor="#EF6C00"
      />
      <StatCard
        label="Partners Available for Assignment"
        value={approvedDeliveryPartners.length.toLocaleString()}
        icon="🤝"
        bgColor="#E8F5E9"
        textColor="#388E3C"
      />
    </div>

    {/* 🔹 Generate / Assign / Refresh Controls */}
    <div style={styles.formCard}>
      <h3 style={styles.cardTitle}>Generate & Assign QR Bottles</h3>
      <div style={{ display: "flex", gap: "15px", flexWrap: "wrap" }}>
        <button
          style={{ ...styles.button, backgroundColor: "#1565C0", color: "#fff" }}
          onClick={handleGenerateQR}
          disabled={loading}
        >
          {loading ? "Generating..." : "Generate New QR"}
        </button>

        <button
          style={{ ...styles.button, backgroundColor: "#2E7D32", color: "#fff" }}
          onClick={() => setQrAssigning(true)}
          disabled={unassignedBottles.length === 0}
        >
          Assign Bottles to Partner
        </button>

        {/* ✅ Refresh both bottles + summary */}
        <button
          style={{ ...styles.button, backgroundColor: "#6A1B9A", color: "#fff" }}
          onClick={() => {
            fetchUnassignedBottles();
            fetchQrSummary();
          }}
        >
          Refresh QR Data
        </button>
      </div>
    </div>

    {/* 🔹 QR Table */}
    <div style={styles.tableCard}>
      <h3 style={styles.cardTitle}>
        Unassigned Bottles ({unassignedBottles.length})
      </h3>

      {unassignedBottles.length === 0 ? (
        <p style={{ textAlign: "center", color: "#777", marginTop: "20px" }}>
          No unassigned bottles found.
        </p>
      ) : (
        <table style={styles.dataTable}>
          <thead>
            <tr style={styles.tableHeaderRow}>
              <th style={styles.tableHeaderCell}>UUID</th>
              <th style={styles.tableHeaderCell}>QR Code</th>
              <th style={styles.tableHeaderCell}>Select</th>
            </tr>
          </thead>
          <tbody>
            {unassignedBottles.map((bottle) => (
              <tr key={bottle.UUID} style={styles.tableRow}>
                <td style={styles.tableCell}>{bottle.UUID}</td>

                {/* ✅ QR Image + Buttons + Code */}
                <td style={styles.tableCell}>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                    }}
                  >
                    <QRCodeCanvas
                      id={`qr-${bottle.UUID}`}
                      value={bottle.qr_code}
                      size={80}
                      includeMargin={true}
                    />

                    <div
                      style={{
                        display: "flex",
                        gap: "6px",
                        marginTop: "6px",
                        borderTop: "1px solid #eee",
                        paddingTop: "4px",
                      }}
                    >
                      {/* 📋 Copy Button */}
                      <button
                        style={{
                          fontSize: "11px",
                          padding: "4px 6px",
                          border: "1px solid #ccc",
                          borderRadius: "4px",
                          cursor: "pointer",
                          backgroundColor: "#f9f9f9",
                        }}
                        onClick={() => {
                          navigator.clipboard.writeText(bottle.qr_code);
                          alert("QR code copied: " + bottle.qr_code);
                        }}
                      >
                        📋 Copy
                      </button>

                      {/* ⬇️ Download Button */}
                      {/* ⬇️ Download Button with QR + Text in Image */}
                      <button
                        style={{
                          fontSize: "11px",
                          padding: "4px 6px",
                          border: "1px solid #ccc",
                          borderRadius: "4px",
                          cursor: "pointer",
                          backgroundColor: "#f9f9f9",
                        }}
                        onClick={() => {
                          const qrCanvas = document.getElementById(`qr-${bottle.UUID}`);
                          const qrCodeText = bottle.qr_code;

                          // Create a new canvas to combine QR + text
                          const combinedCanvas = document.createElement("canvas");
                          const ctx = combinedCanvas.getContext("2d");

                          const qrSize = 100; // match your QR size
                          const padding = 20;
                          const textHeight = 20;
                          const totalHeight = qrSize + textHeight + padding;

                          combinedCanvas.width = qrSize + padding;
                          combinedCanvas.height = totalHeight;

                          // Draw white background
                          ctx.fillStyle = "#fff";
                          ctx.fillRect(0, 0, combinedCanvas.width, combinedCanvas.height);

                          // Draw the QR image
                          ctx.drawImage(qrCanvas, padding / 2, padding / 2, qrSize, qrSize);

                          // Draw QR code text below
                          ctx.fillStyle = "#000";
                          ctx.font = "14px Arial";
                          ctx.textAlign = "center";
                          ctx.fillText(
                            qrCodeText,
                            combinedCanvas.width / 2,
                            qrSize + textHeight
                          );

                          // Download combined image
                          const pngUrl = combinedCanvas
                            .toDataURL("image/png")
                            .replace("image/png", "image/octet-stream");
                          const downloadLink = document.createElement("a");
                          downloadLink.href = pngUrl;
                          downloadLink.download = `${bottle.qr_code}.png`;
                          document.body.appendChild(downloadLink);
                          downloadLink.click();
                          document.body.removeChild(downloadLink);
                        }}
                      >
                        ⬇️ Download
                      </button>

                    </div>

                    {/* ✅ Show QR Text Below for Manual Entry */}
                    <p
                      style={{
                        fontSize: "13px",
                        color: "#333",
                        marginTop: "6px",
                        fontWeight: "500",
                        wordBreak: "break-all",
                        textAlign: "center",
                      }}
                    >
                      {bottle.qr_code}
                    </p>
                  </div>
                </td>

                {/* ✅ Selection Checkbox */}
                <td style={styles.tableCell}>
                  <input
                    type="checkbox"
                    checked={selectedBottlesToAssign.includes(bottle.qr_code)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedBottlesToAssign([
                          ...selectedBottlesToAssign,
                          bottle.qr_code,
                        ]);
                      } else {
                        setSelectedBottlesToAssign(
                          selectedBottlesToAssign.filter(
                            (code) => code !== bottle.qr_code
                          )
                        );
                      }
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  </div>
);




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



// 🟢 RENDER ACTIVE STORES LIST FUNCTION 🟢
const renderActiveStoresList = () => {
  if (loading) {
    return <p style={styles.loadingText}>Loading active stores...</p>;
  }

  const activeStores = stores;

  return (
    <div style={styles.contentArea}>
      <h2 style={styles.pageTitle}>
        Active Stores List ({activeStores.length})
      </h2>

      {/* Add New Store Form */}
      <div style={styles.formCard}>
        <h3 style={styles.cardTitle}>Add New Store</h3>
        <form onSubmit={handleAddStore} style={styles.form}>
          <input
            style={styles.textInput}
            type="text"
            placeholder="Store Name"
            value={newStoreName}
            onChange={(e) => setNewStoreName(e.target.value)}
            required
          />
          <input
            style={styles.textInput}
            type="text"
            placeholder="City"
            value={newStoreCity}
            onChange={(e) => setNewStoreCity(e.target.value)}
            required
          />
          <input
            style={styles.textInput}
            type="text"
            placeholder="Address"
            value={newStoreAddress}
            onChange={(e) => setNewStoreAddress(e.target.value)}
          />
          <input
            style={styles.textInput}
            type="number"
            step="any"
            placeholder="Latitude"
            value={newStoreLat}
            onChange={(e) => setNewStoreLat(e.target.value)}
          />
          <input
            style={styles.textInput}
            type="number"
            step="any"
            placeholder="Longitude"
            value={newStoreLong}
            onChange={(e) => setNewStoreLong(e.target.value)}
          />
          <button
            style={{ ...styles.button, ...styles.primaryButton }}
            type="submit"
            disabled={loading}
          >
            {loading ? "Adding..." : "Add Store"}
          </button>
        </form>
      </div>

      <div style={styles.tableCard}>
        {activeStores.length > 0 ? (
          <table style={styles.dataTable}>
            <thead>
              <tr style={styles.tableHeaderRow}>
                <th style={styles.tableHeaderCell}>Store Name</th>
                <th style={styles.tableHeaderCell}>City</th>
                <th style={styles.tableHeaderCell}>Address</th>
                <th style={styles.tableHeaderCell}>Latitude</th>
                <th style={styles.tableHeaderCell}>Longitude</th>
                <th style={styles.tableHeaderCell}>Partner(s)</th>
                <th style={styles.tableHeaderCell}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeStores.map((store) => {
                const assignedPartners = partners.filter((partner) =>
                  partner.stores.some((s) => s.id === store.id)
                );
                const partnerNames =
                  assignedPartners.map((p) => p.full_name).join(", ") || "N/A";

                return (
                  <tr key={store.id} style={styles.tableRow}>
                    <td style={styles.tableCell}>{store.store_name}</td>
                    <td style={styles.tableCell}>{store.city || "N/A"}</td>
                    <td style={styles.tableCell}>{store.address || "N/A"}</td>
                    <td style={styles.tableCell}>{store.latitude || "N/A"}</td>
                    <td style={styles.tableCell}>{store.longitude || "N/A"}</td>
                    <td style={styles.tableCell}>{partnerNames}</td>
                    <td style={styles.tableCell}>
                      <button
                        style={{
                          ...styles.actionButton,
                          backgroundColor: "#00B8D9",
                        }}
                        onClick={() => {
                          setSelectedStoreForDetails(store);
                          setIsStoreDetailsModalVisible(true);
                        }}
                      >
                        View Details
                      </button>

                      {/* Delete Store Button */}
                      <button
                        style={{
                          ...styles.actionButton,
                          backgroundColor: "#E74C3C",
                          marginLeft: "8px",
                        }}
                        onClick={() => handleDeleteStore(store.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p
            style={{
              ...styles.loadingText,
              marginTop: "20px",
              marginBottom: "20px",
            }}
          >
            No active stores found.
          </p>
        )}
      </div>

      {/* Store Details Modal */}
      <StoreDetailsModal
        isVisible={isStoreDetailsModalVisible}
        onClose={() => setIsStoreDetailsModalVisible(false)}
        store={selectedStoreForDetails}
        partners={partners}
        modalStyles={styles.modalStyles}
      />
    </div>
  );
};




  // ==========================
// 🔹 RENDER CONTENT HANDLER
// ==========================
const renderContent = () => {
  switch (currentTab) {
    case "dashboard":
      return renderDashboard();
    case "orders":
      return renderOrders();
    case "createPartner":
      return renderCreatePartner();
    case "myPartners":
      return renderMyPartners();
    case "deliveryPartners":
      return renderDeliveryPartners();
    case "complaints":
      return renderComplaints();
    case "reports":
      return renderReports();
    case "qrManagement":
      return renderQrManagement();

    case "activeStoresList":
      return renderActiveStoresList();
    default:
      return renderDashboard();
  }
};

// ==========================
// 🔹 MAIN RETURN LAYOUT
// ==========================
return (
  <>
    {/* --- MAIN DASHBOARD LAYOUT --- */}
    <div
      className="dashboard-container"
      style={{ display: "flex", height: "100vh", overflow: "hidden" }}
    >
      {/* --- SIDEBAR --- */}
      {/* ✅ FIX: The Sidebar component is now self-closing (ends with />) 
            All SidebarItem components have been removed from here. */}
      <Sidebar className="sidebar" currentTab={currentTab} onSelectTab={handleSelectTab} />

      {/* --- MAIN CONTENT --- */}
      <div
        className="dashboard-content"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          overflow: "hidden",
        }}
      >
        {/* --- HEADER --- */}
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "#fff",
            padding: "15px 25px",
            borderRadius: "10px",
            boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
            flexShrink: 0,
            zIndex: 100,
          }}
        >
          <h1 style={{ margin: 0, color: "#102a43", fontSize: "22px" }}>
            Super Admin Dashboard
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ color: "#102a43", fontWeight: 500 }}>Admin User</span>
            <button
              style={{
                backgroundColor: "#ff4d4f",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                padding: "8px 16px",
                cursor: "pointer",
                fontWeight: "bold",
                transition: "background-color 0.3s",
              }}
              onClick={handleLogout}
              onMouseOver={(e) => (e.target.style.backgroundColor = "#e04344")}
              onMouseOut={(e) => (e.target.style.backgroundColor = "#ff4d4f")}
            >
              Logout
            </button>
          </div>
        </header>

        {/* --- MAIN BODY SECTION --- */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            backgroundColor: "#f4f6f8",
            padding: "20px 25px",
          }}
        >
          {loading && currentTab === "dashboard" ? (
            <p
              style={{
                textAlign: "center",
                color: "#888",
                fontWeight: 500,
                fontSize: "16px",
                marginTop: "50px",
              }}
            >
              Loading dashboard data...
            </p>
          ) : (
            renderContent()
          )}
        </div>
      </div>
    </div>

    {/* --- GLOBAL MODALS SECTION --- */}
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

    <OrderAssignmentModal
      isVisible={isOrderAssigningModalVisible}
      onClose={() => setIsOrderAssigningModalVisible(false)}
      order={orderToAssign}
      approvedDeliveryPartners={approvedDeliveryPartners}
      onSubmit={handleAssignOrderSubmit}
      selectedPartnerId={selectedDeliveryPartnerId}
      setSelectedPartnerId={setSelectedDeliveryPartnerId}
      modalStyles={styles.modalStyles}
      styles={styles}
      isLoading={loading}
    />

    <AssignBottleModal
      isVisible={qrAssigning}
      onClose={() => setQrAssigning(false)}
      selectedBottlesToAssign={selectedBottlesToAssign}
      approvedDeliveryPartners={approvedDeliveryPartners}
      onAssign={handleAssignBottlesToPartner}
      modalStyles={styles.modalStyles}
    />

    <PartnerDetailsModal
      isVisible={isPartnerDetailsModalVisible}
      onClose={() => setIsPartnerDetailsModalVisible(false)}
      onApprove={handleApprovePartner}
      partner={selectedPartnerForDetails}
      isLoading={loading}
      modalStyles={styles.modalStyles}
    />
  </>
);
};

const styles = {
  dashboardLayout: {
    display: 'flex',
    minHeight: '100vh',
    height: '100vh', // full screen height
    width: '100vw',
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
    overflow: 'hidden',
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
    padding: '20px 30px',
    overflowY: 'auto',
    backgroundColor: '#F8FAFC',
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
  },
modalStyles: {
    backdrop: {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.6)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
    },
    modal: {
      backgroundColor: "#FFFFFF",
      padding: "30px",
      borderRadius: "12px",
      width: "400px",
      maxWidth: "90%",
      boxShadow: "0 8px 20px rgba(0,0,0,0.2)",
    },
    title: {
      fontSize: "20px",
      fontWeight: "600",
      color: "#333",
      marginBottom: "20px",
    },
    textarea: {
      width: "100%",
      padding: "10px",
      borderRadius: "6px",
      border: "1px solid #DCE0E6",
      fontSize: "15px",
      resize: "vertical",
      marginBottom: "20px",
      outline: "none",
    },
    actions: {
      display: "flex",
      justifyContent: "flex-end",
      gap: "10px",
    },
    cancelButton: {
      padding: "10px 18px",
      borderRadius: "6px",
      border: "1px solid #CCC",
      backgroundColor: "#F5F5F5",
      color: "#333",
      cursor: "pointer",
    },
    submitButton: {
      padding: "10px 18px",
      borderRadius: "6px",
      border: "none",
      backgroundColor: "#4CAF50",
      color: "#FFFFFF",
      fontWeight: "600",
      cursor: "pointer",
    },
  },
  modalSubtitle: {
    fontSize: "16px",
    color: "#6B7280",
    marginBottom: "20px",
    textAlign: "left",
    borderBottom: "1px solid #EEE",
    paddingBottom: "15px",
  },
  detailsGrid: {
    display: "flex",
    flexDirection: "row",
    gap: "20px",
  },
  detailsColumn: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  detailItem: {
    display: "flex",
    flexDirection: "column",
  },
  detailLabel: {
    fontSize: "13px",
    fontWeight: "600",
    color: "#555",
    margin: "0 0 4px 0",
  },
  detailValue: {
    fontSize: "15px",
    color: "#333",
    margin: "0",
    wordBreak: "break-word",
  },
  imageItem: {
    display: "flex",
    flexDirection: "column",
    gap: "5px",
  },
  detailImage: {
    width: "100%",
    maxWidth: "250px",
    height: "auto",
    borderRadius: "8px",
    border: "1px solid #DDD",
    backgroundColor: "#F8F8F8",
  },


  

    
};

 
export default SuperAdminDashboard;