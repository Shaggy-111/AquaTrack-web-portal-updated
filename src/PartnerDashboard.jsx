import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
// We are temporarily removing chart imports to focus on UI structure,
// but they can be re-added if you reinstall the chart library.

// --- Configuration ---
const API_BASE_URL = 'https://aquatrack-backend.fly.dev';
const BOTTLE_PRICE = 42;

// --- Helper Functions ---
const backendToUiStatus = (s) => {
    if (s === 'pending') return 'Pending';
    if (s === 'in_progress' || s === 'accepted') return 'In Transit';
    if (s === 'delivered') return 'Delivered';
    if (s === 'cancelled') return 'Cancelled';
    return 'Pending';
};

// FIX: Helper to ensure the report link is an absolute URL
const getAbsoluteReportUrl = (filePath) => {
    if (!filePath) return '#';
    
    // If the path already includes the protocol, return it directly
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
        return filePath;
    }
    // If it's a relative path (e.g., /files/report.pdf), prepend the base URL
    // We assume all paths returned by the backend need the base URL
    return `${API_BASE_URL}${filePath.startsWith('/') ? '' : '/'}${filePath}`;
};

const mapComplaint = (c) => {
    const raisedBy = c.created_by?.role === 'partner' ? 'Partner' : 'Delivery Partner';
    return {
        id: String(c.id),
        subject: c.subject,
        description: c.description,
        raisedBy: raisedBy,
        date: new Date(c.created_at),
        status: backendToUiStatus(c.status),
        solution: c.solution,
    };
};

const mapOrderData = (apiData) => {
    if (!apiData) return [];
    return apiData.map(item => ({
        id: String(item.id),
        bottles: parseInt(item.order_details, 10),
        status: backendToUiStatus(item.status),
        orderDate: new Date(item.created_at),
        isPartnerOrder: !!item.partner_id,
        partnerName: item.partner ? item.partner.full_name : 'N/A',
        customerName: item.store ? item.store.store_name : 'Customer',
    }));
};

const exportToExcel = (data, fileName) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Orders");
    XLSX.writeFile(wb, `${fileName}.xlsx`);
};

// --- Reusable Components ---

// UPDATED StatCard to correctly handle hover state using React Hooks
const StatCard = ({ label, value, icon, bgColor, textColor, onPress, unit = '' }) => {
    const [isHovered, setIsHovered] = useState(false);

    const cardStyle = useMemo(() => ({
        ...styles.statCard, 
        backgroundColor: bgColor,
        transform: isHovered ? 'translateY(-3px)' : 'translateY(0)',
        boxShadow: isHovered ? '0 10px 20px rgba(0,0,0,0.1)' : styles.statCard.boxShadow,
    }), [bgColor, isHovered]);

    return (
        <div
            style={cardStyle}
            onClick={onPress}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div style={{...styles.statIcon, color: textColor}}>{icon}</div>
            <div style={styles.statContent}>
                <p style={{ ...styles.statValue, color: textColor }}>
                    {value}
                    {unit && <span style={{ fontSize: '0.6em', opacity: 0.8, marginLeft: '5px' }}>{unit}</span>}
                </p>
                <p style={styles.statLabel}>{label}</p>
            </div>
        </div>
    );
};


// SidebarItem remains the same
const SidebarItem = ({ label, icon, name, active, onSelect }) => (
    <button
        key={name}
        style={{ ...styles.sidebarItem, ...(active ? styles.sidebarItemActive : {}) }}
        onClick={() => onSelect(name)}
    >
        <span style={styles.sidebarIcon}>{icon}</span>
        <span style={styles.sidebarText}>{label}</span>
    </button>
);

const Sidebar = ({ currentTab, onSelectTab }) => (
    <aside style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
            <h2 style={styles.sidebarHeaderTitle}>AquaTrack</h2>
        </div>
        <nav style={styles.sidebarNav}>
            <SidebarItem label="Dashboard" icon="🏠" name="dashboard" active={currentTab === 'dashboard'} onSelect={onSelectTab} />
            <SidebarItem label="My Orders" icon="📦" name="myOrders" active={currentTab === 'myOrders'} onSelect={onSelectTab} />
            <SidebarItem label="Place Order" icon="🛒" name="placeOrder" active={currentTab === 'placeOrder'} onSelect={onSelectTab} />
            <SidebarItem label="Complaints" icon="💬" name="complaints" active={currentTab === 'complaints'} onSelect={onSelectTab} />
            <SidebarItem label="Empty Bottles" icon="♻️" name="emptyBottles" active={currentTab === 'emptyBottles'} onSelect={onSelectTab} />
            <SidebarItem label="Test Reports" icon="📄" name="testReports" active={currentTab === 'testReports'} onSelect={onSelectTab} />
        </nav>
    </aside>
);

// --- Main Component ---
const PartnerDashboard = () => {
    const [currentTab, setCurrentTab] = useState('dashboard');
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const [bottlesToOrder, setBottlesToOrder] = useState('');
    const [orderAmount, setOrderAmount] = useState(0);
    const [partnerStoreId, setPartnerStoreId] = useState(null);

    const [myOrders, setMyOrders] = useState([]);
    const [totalOrders, setTotalOrders] = useState(0);
    const [pendingOrders, setPendingOrders] = useState(0);
    const [deliveredOrders, setDeliveredOrders] = useState(0);
    const [emptyBottleCount, setEmptyBottleCount] = useState(0);

    const [reports, setReports] = useState([]);
    const [reportsLoading, setReportsLoading] = useState(true);

    const [newComplaints, setNewComplaints] = useState(0);
    const [pendingDeliveryComplaints, setPendingDeliveryComplaints] = useState(0);
    const [pendingYourComplaints, setPendingYourComplaints] = useState(0);

    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [filteredOrders, setFilteredOrders] = useState([]);

    const [newComplaintSubject, setNewComplaintSubject] = useState('');
    const [newComplaintDescription, setNewComplaintDescription] = useState('');
    const [complaintsRaised, setComplaintsRaised] = useState([]);
    const [complaintsAssigned, setComplaintsAssigned] = useState([]);

    const [todayOrders, setTodayOrders] = useState(0);
    const [deliveredToday, setDeliveredToday] = useState(0);
    const [deliveredThisMonth, setDeliveredThisMonth] = useState(0);
    const [lastFiveOrders, setLastFiveOrders] = useState([]); // NEW state for Recent Activity

    // 🟢 NEW DATA AGGREGATION FOR CHART 🟢
    const getMonthlyOrderData = useMemo(() => {
        const monthlyData = {};
        
        myOrders.forEach(order => {
            if (order.status !== 'Delivered') return; // Only count delivered orders for revenue

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
    }, [myOrders]);
    
    // 🟢 ADD SECURE DOWNLOAD HANDLER 🟢
    const handleReportDownload = async (reportId) => {
        const accessToken = localStorage.getItem('partner_token');
        if (!accessToken) {
            alert("Authentication required to download file. Please log in again.");
            navigate('/login/partner');
            return;
        }

        setLoading(true);

        try {
            // Use axios to make the authenticated request, expecting a binary file (blob)
            const response = await axios.get(
                `${API_BASE_URL}/reports/reports/download/${reportId}`,
                {
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                    responseType: 'blob', // IMPORTANT: Handle response as binary data
                }
            );

            if (response.status === 200) {
                // Create a blob URL and temporary link to trigger download
                const blob = new Blob([response.data], { type: response.headers['content-type'] });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                
                // Using ID and current date for filename
                const filename = `Report_${reportId}_${new Date().toISOString().slice(0, 10)}.pdf`;

                link.href = url;
                link.setAttribute('download', filename);
                document.body.appendChild(link);
                link.click();
                link.remove();
                window.URL.revokeObjectURL(url);
                
            } else {
                throw new Error(`Server returned status ${response.status}.`);
            }
        } catch (error) {
            console.error('Download failed:', error.response?.data || error.message);
            
            // Improved error handling to read JSON response from Blob
            if (error.response && error.response.data instanceof Blob) {
                const reader = new FileReader();
                reader.onload = function() {
                    try {
                        const errorJson = JSON.parse(reader.result);
                        alert(`Download Error: ${errorJson.detail || 'File access denied.'}`);
                    } catch (e) {
                        alert('Download failed: Cannot read server error message. Check console.');
                    }
                };
                reader.readAsText(error.response.data);
            } else {
                alert('File download failed. Check console for network/server status.');
            }

        } finally {
            setLoading(false);
        }
    };


    const fetchEmptyBottles = async (token) => {
        try {
            const response = await axios.get(`${API_BASE_URL}/bottle/partner/me/empty-bottles`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (typeof response.data === 'number') {
                setEmptyBottleCount(response.data);
            } else {
                console.error('Invalid empty bottles response:', response.data);
                setEmptyBottleCount(0);
            }
        } catch (error) {
            console.error('Failed to fetch empty bottles:', error);
            setEmptyBottleCount(0);
        }
    };

    useEffect(() => {
        const checkTokenAndFetchData = async () => {
            setLoading(true);
            const token = localStorage.getItem('partner_token');

            if (!token) {
                alert('Session Expired: Please log in again.');
                navigate('/login/partner');
                setLoading(false);
                return;
            }

            fetchData(token);
            fetchComplaints(token);
            fetchReports(token);
            fetchEmptyBottles(token);
        };

        checkTokenAndFetchData();
    }, [navigate]);

    const fetchData = async (token) => {
        try {
            const storesResponse = await axios.get(`${API_BASE_URL}/partners/partners/me/stores`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });

            if (storesResponse.status === 401) {
                alert('Session Expired: Your session has expired. Please log in again.');
                handleLogout();
                return;
            }

            const storesData = storesResponse.data;
            if (storesData.length > 0) {
                setPartnerStoreId(storesData[0].id);
            } else {
                console.warn('Store information missing for partner.');
            }

            const ordersResponse = await axios.get(`${API_BASE_URL}/partner/orders/me`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });

            const ordersData = ordersResponse.data;

            const formattedOrders = (ordersData || []).map((order) => ({
                id: order.id.toString(),
                bottles: parseInt(order.order_details, 10),
                status: backendToUiStatus(order.status),
                orderDate: new Date(order.created_at),
                customerName: order.store?.store_name || 'Store',
                isPartnerOrder: true,
                partnerName: order.partner ? order.partner.full_name : 'Partner',
            }));

            setMyOrders(formattedOrders);
            setFilteredOrders(formattedOrders);

            const today = new Date();
            const currentMonth = today.getMonth();
            const currentYear = today.getFullYear();

            const todayOrdersCount = formattedOrders.filter(
                (order) => order.orderDate.toDateString() === today.toDateString()
            ).length;

            const deliveredTodayCount = formattedOrders.filter(
                (order) => order.status === 'Delivered' && order.orderDate.toDateString() === today.toDateString()
            ).length;

            const deliveredThisMonthCount = formattedOrders.filter(
                (order) => order.status === 'Delivered' && order.orderDate.getMonth() === currentMonth && order.orderDate.getFullYear() === currentYear
            ).length;

            // Sort orders to get the recent ones
            const sortedOrders = [...formattedOrders].sort((a, b) => b.orderDate - a.orderDate);
            setLastFiveOrders(sortedOrders.slice(0, 5));
            

            setTotalOrders(formattedOrders.length);
            setPendingOrders(formattedOrders.filter((o) => o.status === 'Pending' || o.status === 'In Transit').length);
            setDeliveredOrders(formattedOrders.filter((o) => o.status === 'Delivered').length);
            setTodayOrders(todayOrdersCount);
            setDeliveredToday(deliveredTodayCount);
            setDeliveredThisMonth(deliveredThisMonthCount);

        } catch (error) {
            console.error('API call failed:', error);
            alert('Data Fetch Error: Failed to fetch dashboard data. Please check your network and try again.');
        } finally {
            setLoading(false);
        }
    };

    const fetchComplaints = async (token) => {
        try {
            const myComplaintsResponse = await axios.get(
                `${API_BASE_URL}/complaints/complaints/me`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            setComplaintsRaised(myComplaintsResponse.data);

            setPendingYourComplaints(
                myComplaintsResponse.data.filter(
                    (c) => c.status === "pending"
                ).length
            );
        } catch (error) {
            console.error(
                "Failed to fetch raised complaints:",
                error.response?.data || error.message
            );
            setComplaintsRaised([]);
            setPendingYourComplaints(0);
        }

        try {
            const assignedComplaintsResponse = await axios.get(
                `${API_BASE_URL}/complaints/complaints/assigned`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            setComplaintsAssigned(assignedComplaintsResponse.data);

            setNewComplaints(
                assignedComplaintsResponse.data.filter(
                    (c) => c.status === "pending"
                ).length
            );
            setPendingDeliveryComplaints(
                assignedComplaintsResponse.data.filter(
                    (c) => c.status === "pending"
                ).length
            );
        } catch (error) {
            if (axios.isAxiosError(error) && error.response?.status === 404) {
                console.log("No complaints assigned.");
                setComplaintsAssigned([]);
                setNewComplaints(0);
                setPendingDeliveryComplaints(0);
            } else {
                console.error(
                    "Failed to fetch assigned complaints:",
                    error.response?.data || error.message
                );
                setComplaintsAssigned([]);
                setNewComplaints(0);
                setPendingDeliveryComplaints(0);
            }
        }
    };

    const fetchReports = async (token) => {
        setReportsLoading(true);
        try {
            const response = await axios.get(`${API_BASE_URL}/reports/reports/list`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            setReports(response.data);
        } catch (error) {
            console.error('Failed to fetch reports:', error);
            alert('Error: Failed to load reports.');
            setReports([]);
        } finally {
            setReportsLoading(false);
        }
    };

    const handleLogout = () => {
        if (window.confirm('Are you sure you want to log out?')) {
            localStorage.removeItem('partner_token');
            navigate('/login/partner');
        }
    };

    const handleSelectTab = (tab) => {
        setCurrentTab(tab);
    };

    const handleClearDates = () => {
        setStartDate('');
        setEndDate('');
    };

    useEffect(() => {
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const filtered = myOrders.filter(order => {
                const orderDate = new Date(order.orderDate);
                // Compare dates
                return orderDate >= start && orderDate <= end;
            });
            setFilteredOrders(filtered);
        } else {
            setFilteredOrders(myOrders);
        }
    }, [startDate, endDate, myOrders]);

    const handleExportOrders = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('partner_token');
            if (!token) {
                alert('Authentication failed: Please log in again.');
                navigate('/login/partner');
                return;
            }

            const response = await axios.get(`${API_BASE_URL}/partners/partners/me/orders/export-all`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });

            if (response.data.length === 0) {
                alert('No Data: There are no orders to export.');
                return;
            }

            const ordersForExport = response.data.map((order) => ({
                'Order ID': order.id,
                'Bottles': order.order_details,
                'Status': order.status,
                'Date': new Date(order.created_at).toLocaleDateString(),
                'Customer Name': order.store?.store_name || 'N/A',
            }));

            const fileName = `My_Orders_${new Date().toISOString().slice(0, 10)}`;

            exportToExcel(ordersForExport, fileName);

            alert('Success: Orders exported successfully!');

        } catch (error) {
            if (axios.isAxiosError(error)) {
                console.error('API Error:', error.response?.data || error.message);
                alert(`Export Error: ${error.response?.data.detail || 'Failed to fetch orders for export. Please check your network and try again.'}`);
            } else if (error instanceof Error) {
                console.error('General Error:', error.message);
                alert(`Export Error: ${error.message}`);
            } else {
                console.error('Unknown Error:', error);
                alert('Export Error: An unexpected error occurred.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleRaiseComplaint = async (e) => {
        e.preventDefault();
        if (newComplaintSubject.trim() === '' || newComplaintDescription.trim() === '') {
            alert('Error: Please fill in all complaint details.');
            return;
        }

        const token = localStorage.getItem('partner_token');
        if (!token) {
            alert('Authentication failed: Please log in again.');
            navigate('/login/partner');
            return;
        }

        const superAdminId = 1; // Assuming Super Admin's ID is 1 for assignment
        const url = `${API_BASE_URL}/complaints/complaints/submit`;

        try {
            const response = await axios.post(url, {
                subject: newComplaintSubject,
                description: newComplaintDescription,
                assigned_to_id: superAdminId,
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (response.status === 201 || response.status === 200) {
                alert('Success: Complaint raised successfully!');
                setNewComplaintSubject('');
                setNewComplaintDescription('');
                fetchComplaints(token);
            }

        } catch (error) {
            if (axios.isAxiosError(error)) {
                console.error('API Error:', error.response?.data || error.message);
                alert(`Error: ${error.response?.data.detail || 'Failed to raise complaint.'}`);
            } else {
                console.error('General Error:', error);
                alert('Error: An unexpected error occurred while raising the complaint.');
            }
        }
    };

    const handlePlaceOrder = async (e) => {
        e.preventDefault();
        const bottles = parseInt(bottlesToOrder, 10);
        const totalAmount = bottles * BOTTLE_PRICE;

        if (!partnerStoreId) {
            alert('Error: Store information is missing. Please try refreshing or logging in again.');
            return;
        }

        if (isNaN(bottles) || bottles <= 0) {
            alert('Error: Please enter a valid number of bottles.');
            return;
        }

        setLoading(true);
        try {
            const token = localStorage.getItem('partner_token');
            if (!token) {
                alert('Authentication failed: Please log in again.');
                navigate('/login/partner');
                return;
            }

            const apiEndpoint = `${API_BASE_URL}/partner/orders`;
            const response = await axios.post(apiEndpoint, {
                store_id: partnerStoreId,
                order_details: bottles.toString(),
                total_amount: totalAmount,
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (response.status !== 200 && response.status !== 201) {
                throw new Error(`Failed to place order: ${response.data.detail || response.statusText}`);
            }

            // Refresh data
            alert(`Success: Order for ${bottles} bottles placed successfully!`);
            setBottlesToOrder('');
            setOrderAmount(0);
            await fetchData(token);
            setCurrentTab('myOrders');
        } catch (error) {
            console.error(error);
            if (error instanceof Error) {
                alert(`Error: ${error.message}`);
            } else {
                alert('Error: An unknown error occurred.');
            }
        } finally {
            setLoading(false);
        }
    };
    
    // Helper component to render recent activity items
    const RecentActivityItem = ({ order }) => (
        <div style={styles.activityItem}>
            <p style={styles.activityText}>
                Order **#{order.id}** for **{order.bottles} bottles**
            </p>
            <span style={{
                ...styles.statusBadge,
                backgroundColor: order.status === 'Delivered' ? '#34A853' : (order.status === 'Pending' ? '#F4B400' : '#4285F4'),
                color: '#FFFFFF',
                fontSize: '11px',
                fontWeight: 'bold',
                padding: '4px 8px',
                minWidth: '60px',
            }}>
                {order.status}
            </span>
        </div>
    );
    
    // 🟢 CHART COMPONENT PLACEHOLDER 🟢
    const MonthlyPerformanceChart = ({ data }) => {
        if (data.length === 0) {
            return (
                <div style={styles.chartPlaceholder}>
                    <p>No delivered orders data available for charting.</p>
                </div>
            );
        }
        
        const labels = data.map(d => d.month);
        const revenueData = data.map(d => d.totalRevenue);
        const bottleData = data.map(d => d.totalBottles);

        return (
            <div style={{ height: '350px', width: '100%' }}>
                {/* This div simulates the chart area. Install a chart library (like react-chartjs-2)
                  to render the chart below.
                */}
                <div style={styles.chartPlaceholder}>
                    <h4 style={{ color: '#1A2A44', margin: '5px 0' }}>Monthly Revenue Trend (Last {data.length} Months)</h4>
                    <p style={{marginBottom: 10, color: '#00A896', fontWeight: 'bold'}}>REVENUE VS. BOTTLE VOLUME</p>
                    {data.map((d, index) => (
                        <p key={index} style={{ margin: '3px 0', fontSize: '14px', color: '#333' }}>
                            **{d.month}**: **₹{d.totalRevenue.toLocaleString('en-IN')}** ({d.totalBottles} bottles)
                        </p>
                    ))}
                    <p style={{ marginTop: 20, fontSize: 12, color: '#888' }}>
                         (Chart Placeholder Area)
                    </p>
                </div>
            </div>
        );
    };

    // UPDATED renderDashboard to fit content neatly
    const renderDashboard = () => (
        <div style={styles.scrollContent}>
            <div style={styles.kpiRow}>
                {/* Top KPI Row (3-4 columns) */}
                <StatCard 
                    label="Total Orders" 
                    value={totalOrders.toString()} 
                    icon="📦" 
                    bgColor="#E6F4F1" // Teal/Green Base
                    textColor="#00A896" // Vibrant Teal
                    onPress={() => handleSelectTab('myOrders')} 
                />
                <StatCard 
                    label="Pending Orders" 
                    value={pendingOrders.toString()} 
                    icon="⏳" 
                    bgColor="#FFF7E6" // Yellow Base
                    textColor="#F4B400" // Yellow Accent
                    onPress={() => handleSelectTab('myOrders')} 
                />
                <StatCard 
                    label="Delivered Orders" 
                    value={deliveredOrders.toString()} 
                    icon="✅" 
                    bgColor="#E9F7EF" // Light Green Base
                    textColor="#34A853" // Green Accent
                    onPress={() => handleSelectTab('myOrders')} 
                />
                <StatCard 
                    label="Empty Bottles" 
                    value={emptyBottleCount.toString()} 
                    icon="♻️" 
                    bgColor="#E6F2FF" // Blue Base
                    textColor="#4285F4" // Blue Accent
                    onPress={() => handleSelectTab('emptyBottles')} 
                />
            </div>

            {/* Main Content Area: Sales/Performance (Wide) and Recent Activity (Narrow) */}
            <div style={styles.mainContentGrid}>
                
                {/* 1. Performance Card (Wide) */}
                <div style={styles.performanceCard}>
                    <h3 style={styles.sectionTitle}>Sales & Order Performance</h3>
                    {/* 🟢 Use the Chart Component here 🟢 */}
                    <MonthlyPerformanceChart data={getMonthlyOrderData} />
                </div>

                {/* 2. Recent Activity Card (Narrow) - Fixed Height */}
                <div style={styles.recentActivityCard}>
                    <h3 style={styles.sectionTitle}>Recent Activity (Orders)</h3>
                    <div style={styles.activityList}>
                        {lastFiveOrders.length === 0 ? (
                            <p style={{...styles.activityText, fontStyle: 'italic'}}>No recent orders to display.</p>
                        ) : (
                            lastFiveOrders.map(order => (
                                <RecentActivityItem key={order.id} order={order} />
                            ))
                        )}
                    </div>
                </div>

            </div>

            {/* Bottom KPI Row (Additional Metrics) */}
            <div style={styles.kpiRow}>
                <StatCard 
                    label="Today's Orders" 
                    value={todayOrders.toString()} 
                    icon="📅" 
                    bgColor="#E1F5FE" 
                    textColor="#0277BD" 
                    onPress={() => handleSelectTab('myOrders')} 
                />
                <StatCard 
                    label="Delivered Today" 
                    value={deliveredToday.toString()} 
                    icon="🚚" 
                    bgColor="#FCE4EC" 
                    textColor="#C2185B" 
                    onPress={() => handleSelectTab('myOrders')} 
                />
                <StatCard
                    label="New Complaints"
                    value={newComplaints.toString()}
                    icon="⚠️"
                    bgColor="#FFEBE6"
                    textColor="#E74C3C" 
                    onPress={() => handleSelectTab('complaints')}
                />
                <StatCard
                    label="Pending Your Complaints"
                    value={pendingYourComplaints.toString()}
                    icon="📝"
                    bgColor="#E9F5FF" 
                    textColor="#3498DB"
                    onPress={() => handleSelectTab('complaints')}
                />
            </div>
        </div>
    );


    const renderMyOrders = () => (
        <div style={styles.listContainer}>
            <h2 style={styles.pageTitle}>My Orders</h2>
            <div style={styles.formCard}>
                <h3 style={styles.formTitle}>Search Orders by Date</h3>
                <div style={styles.datePickerRow}>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        style={{ ...styles.textInput, flex: '0.45', marginBottom: 0 }}
                    />
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        style={{ ...styles.textInput, flex: '0.45', marginBottom: 0 }}
                    />
                    {(startDate || endDate) && (
                        <button style={styles.clearButton} onClick={handleClearDates}>✕</button>
                    )}
                </div>
            </div>
            <button style={{ ...styles.button, ...styles.exportButton }} onClick={handleExportOrders} disabled={loading}>
                {loading ? 'Exporting...' : 'Export All Orders'}
            </button>
            <div style={styles.itemCard}>
                <h3 style={styles.formTitle}>All Orders</h3>
                {filteredOrders.length === 0 ? (
                    <p style={styles.noDataText}>No orders found for the selected dates.</p>
                ) : (
                    <table style={styles.dataTable}>
                        <thead>
                            <tr style={styles.tableHeaderRow}>
                                <th style={styles.tableHeaderCell}>Order ID</th>
                                <th style={styles.tableHeaderCell}>Date</th>
                                <th style={styles.tableHeaderCell}>Bottles</th>
                                <th style={styles.tableHeaderCell}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredOrders.map(order => (
                                <tr key={order.id} style={styles.tableRow}>
                                    <td style={styles.tableCell}>{order.id}</td>
                                    <td style={styles.tableCell}>{new Date(order.orderDate).toLocaleDateString()}</td>
                                    <td style={styles.tableCell}>{order.bottles}</td>
                                    <td style={styles.tableCell}>
                                        <span style={{
                                            ...styles.statusBadge,
                                            backgroundColor: order.status === 'Delivered' ? '#00A896' : // Teal 
                                                                order.status === 'In Transit' ? '#F4B400' : // Yellow
                                                                order.status === 'Pending' ? '#E74C3C' : '#34495E' // Red/Grey
                                            }}>
                                            {order.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );

    const renderPlaceOrder = () => (
        <div style={styles.scrollContent}>
            <div style={styles.formCard}>
                <h2 style={styles.pageTitle}>Place a New Order</h2>
                <form onSubmit={handlePlaceOrder}>
                    <p style={styles.itemDetails}>
                        Price per bottle: **₹{BOTTLE_PRICE}**
                    </p>
                    <label style={styles.formLabel}>Number of Bottles</label>
                    <input
                        type="number"
                        style={styles.textInput}
                        placeholder="Enter number of bottles"
                        value={bottlesToOrder}
                        onChange={(e) => {
                            const text = e.target.value;
                            setBottlesToOrder(text);
                            const numBottles = parseInt(text, 10);
                            if (!isNaN(numBottles) && numBottles > 0) {
                                setOrderAmount(numBottles * BOTTLE_PRICE);
                            } else {
                                setOrderAmount(0);
                            }
                        }}
                    />
                    <label style={styles.formLabel}>Total Amount</label>
                    <p style={styles.totalAmountText}>₹{orderAmount}</p>
                    <button
                        type="submit"
                        style={{ ...styles.button, ...styles.createButton }}
                        disabled={loading}
                    >
                        {loading ? 'Submitting...' : 'Submit Order'}
                    </button>
                </form>
            </div>
            </div>
    );

    const renderComplaints = () => (
        <div style={styles.scrollContent}>
            <div style={styles.cardContainer}>
                <h2 style={styles.pageTitle}>Complaints</h2>

                <div style={styles.formCard}>
                    <h3 style={styles.formTitle}>Raise a New Complaint</h3>
                    <form onSubmit={handleRaiseComplaint}>
                        <input
                            style={styles.textInput}
                            placeholder="Complaint Subject"
                            value={newComplaintSubject}
                            onChange={(e) => setNewComplaintSubject(e.target.value)}
                            required
                        />
                        <textarea
                            style={{ ...styles.textInput, height: 100 }}
                            placeholder="Complaint Description"
                            value={newComplaintDescription}
                            onChange={(e) => setNewComplaintDescription(e.target.value)}
                            required
                        />
                        <button
                            type="submit"
                            style={{ ...styles.button, ...styles.createButton }}
                        >
                            Raise Complaint
                        </button>
                    </form>
                </div>

                <div style={styles.complaintSection}>
                    <h3 style={styles.formTitle}>Complaints Raised by You</h3>
                    {complaintsRaised.length === 0 ? (
                        <p style={styles.noDataText}>No complaints raised by you.</p>
                    ) : (
                        complaintsRaised.map((c) => (
                            <div key={c.id} style={{ ...styles.itemCard, ...(c.status === "resolved" && styles.resolvedCard) }}>
                                <div style={styles.itemHeader}>
                                    <p style={styles.itemTitle}>
                                        {c.subject}{" "}
                                        <span style={{ fontSize: '12px', color: '#6B7280' }}>
                                            (ID: {c.id})
                                        </span>
                                    </p>
                                    <span style={{
                                        ...styles.statusBadge,
                                        backgroundColor: c.status === "pending" ? '#E74C3C' : '#00A896'
                                    }}>
                                        {c.status}
                                    </span>
                                </div>
                                <p style={styles.itemDetails}>{c.description}</p>
                                <p style={styles.itemDetails}>
                                    Raised to: **{c.assigned_to.full_name}**
                                </p>
                                {c.solution && (
                                    <p style={{ ...styles.itemDetails, marginTop: 10, fontStyle: 'italic', color: '#00A896', fontWeight: 'bold' }}>
                                        Solution: {c.solution}
                                    </p>
                                )}
                            </div>
                        ))
                    )}
                </div>

                <div style={styles.complaintSection}>
                    <h3 style={styles.formTitle}>Complaints Assigned to You</h3>
                    {complaintsAssigned.length === 0 ? (
                        <p style={styles.noDataText}>
                            No complaints from delivery partners.
                        </p>
                    ) : (
                        complaintsAssigned.map((c) => (
                            <div key={c.id} style={{ ...styles.itemCard, ...(c.status === "resolved" && styles.resolvedCard) }}>
                                <div style={styles.itemHeader}>
                                    <p style={styles.itemTitle}>
                                        {c.subject}{" "}
                                        <span style={{ fontSize: '12px', color: '#6B7280' }}>
                                            (ID: {c.id})
                                        </span>
                                    </p>
                                    <span style={{
                                        ...styles.statusBadge,
                                        backgroundColor: c.status === "pending" ? '#E74C3C' : '#00A896'
                                    }}>
                                        {c.status}
                                    </span>
                                </div>
                                <p style={styles.itemDetails}>{c.description}</p>
                                <p style={styles.itemDetails}>
                                    Raised by: **{c.created_by.full_name}**
                                </p>
                                {c.solution && (
                                    <p style={{ ...styles.itemDetails, marginTop: 10, fontStyle: 'italic', color: '#00A896', fontWeight: 'bold' }}>
                                        Solution: {c.solution}
                                    </p>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );


    const renderEmptyBottles = () => (
        <div style={styles.scrollContent}>
            <div style={styles.cardContainer}>
                <h2 style={styles.pageTitle}>Empty Bottle Management</h2>
                <div style={styles.formCard}>
                    <h3 style={styles.formTitle}>Current Empty Bottles</h3>
                    <p style={styles.emptyBottleCountText}>{emptyBottleCount}</p>
                    <p style={styles.itemDetails}>
                        This is the current count of empty bottles you have in your inventory. This count is used to manage pickups.
                    </p>
                </div>
            </div>
        </div>
    );


    const renderTestReports = () => (
        <div style={styles.listContainer}>
            <h2 style={styles.pageTitle}>Test Reports</h2>
            {reportsLoading ? (
                <div style={{ ...styles.loadingContainer, minHeight: '300px' }}>
                    <p style={styles.loadingText}>Loading reports...</p>
                </div>
            ) : reports.length === 0 ? (
                <p style={styles.noDataText}>No reports available at this time.</p>
            ) : (
                <div style={styles.itemCard}>
                    <h3 style={styles.formTitle}>Available Reports</h3>
                    <table style={styles.dataTable}>
                        <thead>
                            <tr style={styles.tableHeaderRow}>
                                <th style={styles.tableHeaderCell}>ID</th>
                                <th style={styles.tableHeaderCell}>Date</th>
                                <th style={styles.tableHeaderCell}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reports.map((report) => (
                                <tr key={report.id} style={styles.tableRow}>
                                    <td style={styles.tableCell}>{report.id}</td>
                                    <td style={styles.tableCell}>{new Date(report.report_date).toLocaleDateString()}</td>
                                    <td style={styles.tableCell}>
                                        {/* 🟢 FIX 2: CALL THE SECURE HANDLER 🟢 */}
                                        <button 
                                            onClick={() => handleReportDownload(report.id)} 
                                            style={{ ...styles.actionButton, textDecoration: 'none', cursor: 'pointer' }}
                                        >
                                            View PDF
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );

    const renderMainContent = () => {
        if (loading) {
            return (
                <div style={styles.loadingContainer}>
                    <p style={styles.loadingText}>Loading...</p>
                </div>
            );
        }
        switch (currentTab) {
            case 'dashboard':
                return renderDashboard();
            case 'myOrders':
                return renderMyOrders();
            case 'placeOrder':
                return renderPlaceOrder();
            case 'complaints':
                return renderComplaints();
            case 'emptyBottles':
                return renderEmptyBottles();
            case 'testReports':
                return renderTestReports();
            default:
                return <p style={styles.errorText}>Something went wrong!</p>;
        }
    };

    return (
        <div style={styles.dashboardLayout}>
            <Sidebar currentTab={currentTab} onSelectTab={handleSelectTab} />
            <main style={styles.mainPanel}>
                <header style={styles.topHeader}>
                    <h1 style={styles.headerTitle}>Partner Dashboard</h1>
                    <button style={styles.headerLogoutButton} onClick={handleLogout}>
                        <span style={{ marginRight: '8px' }}>🚪</span>Logout
                    </button>
                </header>
                <div style={styles.mainContentArea}>
                    {renderMainContent()}
                </div>
            </main>
            </div>
    );
};

const styles = {
    // --- CORE LAYOUT AND HEADER STYLES ---
    dashboardLayout: {
        display: 'flex',
        minHeight: '100vh',
        backgroundColor: '#F7F9FB', 
        fontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif", 
    },
    sidebar: {
        width: '240px', 
        backgroundColor: '#1A2A44', 
        color: '#ECF0F1',
        padding: '20px 0',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '4px 0 10px rgba(0,0,0,0.15)', 
        zIndex: 10,
    },
    sidebarHeader: {
        padding: '0 20px 25px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        marginBottom: '15px',
    },
    sidebarHeaderTitle: {
        fontSize: '24px',
        fontWeight: '800', 
        color: '#00A896', 
        margin: 0,
    },
    sidebarNav: {
        flexGrow: 1,
        padding: '0 10px',
    },
    sidebarItem: {
        display: 'flex',
        alignItems: 'center',
        padding: '12px 15px',
        borderRadius: '8px', 
        marginBottom: '6px', 
        backgroundColor: 'transparent',
        border: 'none',
        width: '100%',
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'background-color 0.2s ease, color 0.2s ease',
        fontSize: '15px',
        color: '#BDC3C7', 
        // Hover effect for sidebar items is handled by the default browser button focus/hover states
    },
    // *** Sidebar Flashy Active State ***
    sidebarItemActive: {
        backgroundColor: '#00A896', // Full Vibrant Teal Fill
        color: '#FFFFFF',
        fontWeight: '700',
        boxShadow: '0 4px 8px rgba(0, 168, 150, 0.6)', // Bright, noticeable shadow
        transform: 'scale(1.02)', // Slight pop effect
    },
    sidebarIcon: {
        fontSize: '18px',
        marginRight: '12px',
    },
    sidebarText: {
        color: 'inherit', 
    },
    mainPanel: {
        flexGrow: 1,
        display: 'flex',
        flexDirection: 'column',
    },
    topHeader: {
        backgroundColor: '#FFFFFF',
        padding: '18px 30px', 
        boxShadow: '0 4px 8px rgba(0,0,0,0.08)', 
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid #EAECEF',
    },
    headerTitle: {
        fontSize: '24px',
        fontWeight: '600',
        color: '#1A2A44',
        margin: 0,
    },
    headerLogoutButton: {
        padding: '10px 20px',
        backgroundColor: '#E74C3C', 
        color: '#FFFFFF',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '16px',
        fontWeight: '600',
        display: 'flex',
        alignItems: 'center',
        transition: 'background-color 0.2s ease, box-shadow 0.2s ease',
        boxShadow: '0 4px 6px rgba(231, 76, 60, 0.4)',
    },
    mainContentArea: {
        flexGrow: 1,
        padding: '25px 30px',
        overflowY: 'auto',
    },
    loadingContainer: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexGrow: 1,
    },
    loadingText: {
        textAlign: 'center',
        fontSize: '18px',
        marginTop: '50px',
        color: '#6B7280',
    },

    // --- CARD AND KPI STYLES (FLASHY) ---
    pageTitle: {
        fontSize: '28px', 
        fontWeight: '700',
        color: '#1A2A44',
        marginBottom: '25px',
        borderLeft: '5px solid #4285F4', 
        paddingLeft: '15px',
        lineHeight: '1.2',
    },
    kpiRow: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
        gap: '20px', 
        marginBottom: '30px',
    },
    // *** KPI Card style - retained flashy appearance (now controlled by React state in StatCard component) ***
    statCard: {
        borderRadius: '12px', 
        padding: '25px', 
        display: 'flex',
        flexDirection: 'row', 
        alignItems: 'center',
        boxShadow: '0 6px 15px rgba(0,0,0,0.12)',
        cursor: 'pointer',
        transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)', 
        minHeight: '100px',
        justifyContent: 'flex-start',
        border: 'none', 
    },
    statIcon: {
        fontSize: '32px', 
        marginRight: '15px', 
        backgroundColor: 'transparent',
    },
    statContent: {
        flex: 1,
        textAlign: 'left',
    },
    statValue: {
        fontSize: '30px', 
        fontWeight: '900', 
        margin: '0',
    },
    statLabel: {
        fontSize: '14px', 
        color: 'rgba(0,0,0,0.7)',
        margin: '0',
        fontWeight: '500',
    },
    
    // --- MAIN CONTENT GRID (FIXED HEIGHT) ---
    mainContentGrid: {
        display: 'grid',
        gridTemplateColumns: '3fr 1fr', 
        gap: '20px', 
        marginBottom: '30px',
    },
    performanceCard: {
        backgroundColor: '#fff',
        borderRadius: '12px',
        padding: '30px',
        boxShadow: '0 6px 15px rgba(0,0,0,0.1)',
        minHeight: '400px',
    },
    recentActivityCard: {
        backgroundColor: '#fff',
        borderRadius: '12px',
        padding: '30px',
        boxShadow: '0 6px 15px rgba(0,0,0,0.1)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '400px', 
    },
    chartPlaceholder: {
        padding: '40px',
        textAlign: 'center',
        color: '#6B7280',
        border: '1px dashed #E0E0E0',
        borderRadius: '8px',
        flexGrow: 1, 
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column', // Allow content to stack vertically
    },
    sectionTitle: {
        fontSize: '20px',
        fontWeight: '700',
        color: '#1A2A44',
        marginBottom: '15px',
        borderBottom: '2px solid #E0E0E0', 
        paddingBottom: '10px',
    },
    activityList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '15px',
        flexGrow: 1, 
        justifyContent: 'flex-start',
    },
    activityItem: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px dashed #DCE0E6',
        paddingBottom: '10px',
    },
    activityText: {
        fontSize: '14px',
        color: '#333',
        margin: 0,
    },

    // --- GENERAL ELEMENTS ---
    itemCard: {
        backgroundColor: '#fff',
        borderRadius: '12px', 
        padding: '25px',
        marginBottom: '20px',
        boxShadow: '0 6px 15px rgba(0,0,0,0.1)',
    },
    formCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: '12px',
        padding: '30px',
        boxShadow: '0 6px 15px rgba(0,0,0,0.1)',
        marginBottom: '30px',
    },
    dataTable: { width: '100%', borderCollapse: 'collapse', },
    tableHeaderRow: { backgroundColor: '#1A2A44', color: '#FFFFFF', textAlign: 'left', borderRadius: '12px 12px 0 0', overflow: 'hidden', },
    tableHeaderCell: { padding: '15px 20px', fontWeight: '600', fontSize: '14px', },
    tableRow: { borderBottom: '1px solid #ECEFF1', transition: 'background-color 0.15s ease', },
    tableCell: { padding: '12px 20px', color: '#333', fontSize: '14px', },
    formTitle: { fontSize: '22px', fontWeight: '600', color: '#1A2A44', marginBottom: '20px', borderBottom: '2px solid #F0F2F5', paddingBottom: '10px', },
    formLabel: { display: 'block', fontSize: '14px', color: '#555', marginBottom: '8px', fontWeight: '600', },
    textInput: { width: '100%', padding: '12px 15px', borderRadius: '8px', border: '1px solid #DCE0E6', fontSize: '16px', color: '#333', outline: 'none', marginBottom: '15px', boxSizing: 'border-box', transition: 'border-color 0.2s ease, box-shadow 0.2s ease', },
    button: { padding: '14px 25px', borderRadius: '8px', border: 'none', color: '#FFFFFF', fontWeight: '600', cursor: 'pointer', fontSize: '16px', transition: 'background-color 0.2s ease', width: '100%', textTransform: 'uppercase', letterSpacing: '0.5px', },
    createButton: { backgroundColor: '#4285F4', marginTop: '15px', boxShadow: '0 4px 6px rgba(66, 133, 244, 0.4)' },
    exportButton: { backgroundColor: '#00A896', marginTop: '10px', marginBottom: '20px', boxShadow: '0 4px 6px rgba(0, 168, 150, 0.4)' },
    statusBadge: { padding: '6px 12px', borderRadius: '20px', color: '#FFFFFF', fontWeight: 'bold', fontSize: '12px', display: 'inline-block', minWidth: '80px', textAlign: 'center', },
    emptyBottleCountText: { fontSize: '60px', fontWeight: 'bold', color: '#00A896', textAlign: 'center', padding: '10px 0', },
    totalAmountText: { fontSize: '32px', fontWeight: 'bold', color: '#4285F4', textAlign: 'center', marginTop: '10px', marginBottom: '25px', padding: '10px', backgroundColor: '#E6F2FF', borderRadius: '8px', },
    noDataText: { textAlign: 'center', color: '#6B7280', fontStyle: 'italic', padding: '30px', border: '1px dashed #DCE0E6', borderRadius: '12px', marginTop: '15px', },
    resolvedCard: { backgroundColor: '#E6F4F1', border: '1px solid #00A896', },
    datePickerRow: { display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '15px', },
    clearButton: { background: 'none', border: '1px solid #DCE0E6', color: '#E74C3C', fontWeight: 'bold', borderRadius: '8px', padding: '10px', cursor: 'pointer', fontSize: '16px', height: '44px', width: '44px', flexShrink: 0, transition: 'background-color 0.2s', },
    actionButton: { display: 'inline-block', padding: '8px 15px', borderRadius: '8px', backgroundColor: '#4285F4', color: '#FFFFFF', fontWeight: '600', fontSize: '13px', boxShadow: '0 2px 4px rgba(66, 133, 244, 0.4)' }
};

export default PartnerDashboard;