import React, { useState, useEffect, use } from "react";
import { Box, Typography, Container } from "@mui/material";
import { styled } from "@mui/material/styles";
import { TransactionList } from "./TransactionList";
import { BudgetSection } from "./BudgetSection";
import NavigationBar from "../navigation/NavigationBar";
import Header from "../common/Header";
import axios from "axios";
import { BalanceDisplay } from "./BalanceDisplay";
import StyledContainer from "../common/StyledContainer";
import APIConfig from "../../APIConfig";
import { useUserContext } from "../contexts/UserContext";

const MainContent = styled(Box)({
  display: "flex",
  width: "100%",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 16px",
});

export default function AccountPage() {
  const [transactions, setTransactions] = useState([]);
  const { user, updateUser } = useUserContext();
  const [budget, setBudget] = useState({});

  useEffect(()=>{
    const fetchBusinessRevenue = async () => {
      try {
          const response = await axios.get(`${APIConfig.baseURL.dev}/api/v1/businessrevenue/${user.businessId}`);
          // const response = await axios.get(`https://ioec2testsspm.infiniteoptions.com/api/v1/businessrevenue/200-000001`)

          // console.log(response.data)
          setBudget(response.data.budget);
          setTransactions(response.data.transactions);
          

          // setMainCategories(mainCategories);
      } catch (error) {
          console.error("Error fetching categories:", error);
      }
  };

  if(user.role === "business"){
    fetchBusinessRevenue();
  }

  }, [])

  // const transactions = [
  //   {
  //     id: 1,
  //     date: "1/10/2025",
  //     name: "Santa Clause & ABC Plumbing",
  //     amount: "$0.10",
  //   },
  //   {
  //     id: 2,
  //     date: "1/10/2025",
  //     name: "Santa Clause & ABC Plumbing",
  //     amount: "$0.10",
  //   },
  //   {
  //     id: 3,
  //     date: "1/10/2025",
  //     name: "Santa Clause & ABC Plumbing",
  //     amount: "$0.10",
  //   },
  //   {
  //     id: 4,
  //     date: "1/10/2025",
  //     name: "Santa Clause & ABC Plumbing",
  //     amount: "$0.10",
  //   },
  //   {
  //     id: 5,
  //     date: "1/10/2025",
  //     name: "Santa Clause & ABC Plumbing",
  //     amount: "$0.10",
  //   },
  //   {
  //     id: 6,
  //     date: "1/10/2025",
  //     name: "Santa Clause & ABC Plumbing",
  //     amount: "$0.10",
  //   },
  // ];

  return (
    <StyledContainer>
      <Header title="Account" />
      <MainContent>
        <BalanceDisplay balance="$48.20" />
        <BudgetSection budgetItems={budget}/>
        <TransactionList transactions={transactions} />
      </MainContent>
      <NavigationBar />
    </StyledContainer>
  );
}
